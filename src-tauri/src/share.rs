use crate::{notes_dir, StoredNoteMetadata};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream, UdpSocket},
    path::Path,
    time::Duration,
};
use tauri::AppHandle;
use time::macros::format_description;
use uuid::Uuid;

const DISCOVERY_PORT: u16 = 51515;
const TRANSFER_PORT: u16 = 51516;
const DISCOVERY_MAGIC: &str = "quickmark_discovery_v1";

#[derive(Serialize, Deserialize)]
struct DiscoveryPing {
    magic: String,
    kind: String, // "ping" | "pong"
    name: String,
    transfer_port: u16,
    id: String,
}

fn host_name_fallback() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "QuickMark".to_string())
}

fn zip_notes_dir(dir: &Path, out_path: &Path) -> Result<(), String> {
    let file = fs::File::create(out_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut add_file = |p: &Path, name_in_zip: &str| -> Result<(), String> {
        zip.start_file(name_in_zip, options).map_err(|e| e.to_string())?;
        let mut f = fs::File::open(p).map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        zip.write_all(&buf).map_err(|e| e.to_string())?;
        Ok(())
    };

    // index.json + all .md files
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if name.eq_ignore_ascii_case("index.json") || name.ends_with(".md") {
                add_file(&path, name)?;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn unzip_into(dir: &Path, zip_path: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut f = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = dir.join(f.name());
        if f.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&out).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn merge_index(dest_index_path: &Path, incoming_index: &[StoredNoteMetadata]) -> Result<(), String> {
    let mut current: Vec<StoredNoteMetadata> = if dest_index_path.exists() {
        let s = fs::read_to_string(dest_index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| e.to_string())?
    } else {
        Vec::new()
    };

    for incoming in incoming_index {
        match current.iter_mut().find(|m| m.id == incoming.id) {
            Some(existing) => {
                // Prefer the newer updated_at
                if incoming.updated_at > existing.updated_at {
                    *existing = incoming.clone();
                }
            }
            None => current.push(incoming.clone()),
        }
    }

    let data = serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?;
    fs::write(dest_index_path, data).map_err(|e| e.to_string())
}

fn read_u64_be(stream: &mut TcpStream) -> Result<u64, String> {
    let mut buf = [0u8; 8];
    stream.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(u64::from_be_bytes(buf))
}

fn write_u64_be(stream: &mut TcpStream, val: u64) -> Result<(), String> {
    stream.write_all(&val.to_be_bytes()).map_err(|e| e.to_string())
}

fn send_file(stream: &mut TcpStream, file_path: &Path) -> Result<(), String> {
    let mut f = fs::File::open(file_path).map_err(|e| e.to_string())?;
    let size = f.metadata().map_err(|e| e.to_string())?.len();
    write_u64_be(stream, size)?;
    let mut buf = [0u8; 8192];
    let mut sent: u64 = 0;
    loop {
        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        stream.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        sent += n as u64;
        if sent >= size { break; }
    }
    Ok(())
}

fn recv_file(stream: &mut TcpStream, out_path: &Path) -> Result<(), String> {
    let size = read_u64_be(stream)?;
    let mut f = fs::File::create(out_path).map_err(|e| e.to_string())?;
    let mut remaining = size as i64;
    let mut buf = [0u8; 8192];
    while remaining > 0 {
        let n = stream.read(&mut buf).map_err(|e| e.to_string())? as i64;
        if n == 0 { break; }
        f.write_all(&buf[..n as usize]).map_err(|e| e.to_string())?;
        remaining -= n;
    }
    Ok(())
}

#[tauri::command]
pub fn receive_notes(app: AppHandle, timeout_secs: Option<u64>) -> Result<String, String> {
    let timeout = timeout_secs.unwrap_or(120);
    let notes_dir_path = notes_dir(&app)?;

    // 1) Listen for discovery pings and reply
    let udp = UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)).map_err(|e| e.to_string())?;
    udp.set_read_timeout(Some(Duration::from_secs(timeout))).ok();
    // 2) Prepare TCP listener
    let listener = TcpListener::bind(("0.0.0.0", TRANSFER_PORT)).map_err(|e| e.to_string())?;
    listener.set_nonblocking(false).ok();

    // Wait for one discovery ping
    let mut buf = [0u8; 2048];
    let (n, from) = udp.recv_from(&mut buf).map_err(|e| e.to_string())?;
    let msg: DiscoveryPing = serde_json::from_slice(&buf[..n]).map_err(|e| e.to_string())?;
    if msg.magic != DISCOVERY_MAGIC || msg.kind != "ping" {
        return Err("Unexpected discovery message".into());
    }

    let pong = DiscoveryPing {
        magic: DISCOVERY_MAGIC.to_string(),
        kind: "pong".into(),
        name: host_name_fallback(),
        transfer_port: TRANSFER_PORT,
        id: Uuid::new_v4().to_string(),
    };
    let pong_bytes = serde_json::to_vec(&pong).map_err(|e| e.to_string())?;
    udp.send_to(&pong_bytes, from).ok();

    // 3) Accept one transfer
    let (mut stream, peer_addr) = listener.accept().map_err(|e| e.to_string())?;
    let zip_tmp = notes_dir_path.join("incoming_notes.zip");
    recv_file(&mut stream, &zip_tmp)?;

    // 4) Unzip into temp folder then merge index
    let temp_extract = notes_dir_path.join("incoming_tmp");
    if temp_extract.exists() { let _ = fs::remove_dir_all(&temp_extract); }
    fs::create_dir_all(&temp_extract).map_err(|e| e.to_string())?;
    unzip_into(&temp_extract, &zip_tmp)?;

    // Load incoming index.json
    let incoming_index_path = temp_extract.join("index.json");
    let incoming_index_str = fs::read_to_string(&incoming_index_path).map_err(|e| e.to_string())?;
    let incoming_index: Vec<StoredNoteMetadata> = serde_json::from_str(&incoming_index_str).map_err(|e| e.to_string())?;

    // Copy *.md files
    for entry in fs::read_dir(&temp_extract).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let file_name = path.file_name().unwrap();
            fs::copy(&path, notes_dir_path.join(file_name)).map_err(|e| e.to_string())?;
        }
    }

    // Merge indices
    let dest_index_path = notes_dir_path.join("index.json");
    merge_index(&dest_index_path, &incoming_index)?;

    // Cleanup
    let _ = fs::remove_file(zip_tmp);
    let _ = fs::remove_dir_all(temp_extract);

    Ok(format!("Received notes from {peer_addr}"))
}

#[tauri::command]
pub fn send_all_notes(app: AppHandle, wait_secs: Option<u64>) -> Result<String, String> {
    // 1) Broadcast discovery ping
    let timeout = wait_secs.unwrap_or(10);
    let udp = UdpSocket::bind(("0.0.0.0", 0)).map_err(|e| e.to_string())?;
    udp.set_broadcast(true).ok();

    let ping = DiscoveryPing {
        magic: DISCOVERY_MAGIC.to_string(),
        kind: "ping".into(),
        name: host_name_fallback(),
        transfer_port: TRANSFER_PORT,
        id: Uuid::new_v4().to_string(),
    };
    let bytes = serde_json::to_vec(&ping).map_err(|e| e.to_string())?;
    let bcast: SocketAddr = format!("255.255.255.255:{}", DISCOVERY_PORT)
        .parse::<SocketAddr>()
        .map_err(|e| e.to_string())?;
    udp.send_to(&bytes, bcast).map_err(|e| e.to_string())?;

    // 2) Wait for first pong
    udp.set_read_timeout(Some(Duration::from_secs(timeout))).ok();
    let mut buf = [0u8; 2048];
    let (n, from) = udp.recv_from(&mut buf).map_err(|e| format!("No receiver found: {}", e))?;
    let msg: DiscoveryPing = serde_json::from_slice(&buf[..n]).map_err(|e| e.to_string())?;
    if msg.magic != DISCOVERY_MAGIC || msg.kind != "pong" {
        return Err("Unexpected discovery response".into());
    }

    // 3) Zip notes dir
    let notes_dir_path = notes_dir(&app)?;
    let tmp_zip = notes_dir_path.join("outgoing_notes.zip");
    zip_notes_dir(&notes_dir_path, &tmp_zip)?;

    // 4) Connect and send
    let target = SocketAddr::new(from.ip(), msg.transfer_port);
    let mut stream = TcpStream::connect(target).map_err(|e| e.to_string())?;
    send_file(&mut stream, &tmp_zip)?;

    // Cleanup
    let _ = fs::remove_file(tmp_zip);

    let fmt = format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");
    let ts = time::OffsetDateTime::now_utc().format(fmt).unwrap_or_default();
    Ok(format!("Sent notes to {} at {}", target, ts))
}
