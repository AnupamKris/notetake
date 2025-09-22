use crate::{notes_dir, StoredNoteMetadata};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream, UdpSocket},
    path::Path,
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use time::macros::format_description;
use uuid::Uuid;
use if_addrs::{get_if_addrs, IfAddr};

const DISCOVERY_PORT: u16 = 51515;
const TRANSFER_PORT: u16 = 51516;
const DISCOVERY_MAGIC: &str = "quickmark_discovery_v1";
const TRANSFER_MAGIC: &str = "quickmark_transfer_v1";

#[derive(Serialize, Deserialize)]
struct DiscoveryPing {
    magic: String,
    kind: String, // "ping" | "pong"
    name: String,
    transfer_port: u16,
    id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PeerInfo {
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub id: String,
}

fn host_name_fallback() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "QuickMark".to_string())
}

fn directed_broadcasts() -> Vec<SocketAddr> {
    let mut out = Vec::new();
    if let Ok(ifaces) = get_if_addrs() {
        for iface in ifaces {
            if iface.is_loopback() { continue; }
            if let IfAddr::V4(v4) = iface.addr {
                let ip = v4.ip.octets();
                let mask = v4.netmask.octets();
                let bcast = [
                    ip[0] | (!mask[0]),
                    ip[1] | (!mask[1]),
                    ip[2] | (!mask[2]),
                    ip[3] | (!mask[3]),
                ];
                let addr = std::net::Ipv4Addr::from(bcast);
                out.push(SocketAddr::from((addr, DISCOVERY_PORT)));
            }
        }
    }
    // Always include global broadcast as last resort
    match format!("255.255.255.255:{}", DISCOVERY_PORT).parse::<SocketAddr>() {
        Ok(a) => out.push(a),
        Err(_) => {}
    }
    out
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

fn load_index_from(dir: &Path) -> Result<Vec<StoredNoteMetadata>, String> {
    let p = dir.join("index.json");
    if !p.exists() { return Ok(Vec::new()); }
    let s = fs::read_to_string(p).map_err(|e| e.to_string())?;
    let items: Vec<StoredNoteMetadata> = serde_json::from_str(&s).map_err(|e| e.to_string())?;
    Ok(items)
}

fn zip_single_note(dir: &Path, note_id: &str, out_path: &Path) -> Result<(), String> {
    let all = load_index_from(dir)?;
    let meta = all.into_iter().find(|m| m.id == note_id)
        .ok_or_else(|| "Note metadata not found".to_string())?;
    let md_path = dir.join(format!("{}.md", note_id));
    if !md_path.exists() { return Err("Note file not found".into()); }

    let file = fs::File::create(out_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // index.json with single entry
    let idx_json = serde_json::to_string_pretty(&vec![meta]).map_err(|e| e.to_string())?;
    zip.start_file("index.json", options).map_err(|e| e.to_string())?;
    zip.write_all(idx_json.as_bytes()).map_err(|e| e.to_string())?;

    // the .md file
    zip.start_file(format!("{}.md", note_id), options).map_err(|e| e.to_string())?;
    let mut f = fs::File::open(md_path).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    zip.write_all(&buf).map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;
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

#[derive(Serialize, Deserialize, Clone)]
struct TransferHeader {
    magic: String,
    kind: String, // all | single
    size: u64,
    filename: String,
}

struct PendingTransfer {
    stream: Option<TcpStream>,
    header: TransferHeader,
    peer: SocketAddr,
}

static LISTENING: AtomicBool = AtomicBool::new(false);
static PENDING: Lazy<Mutex<HashMap<String, PendingTransfer>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn send_header_and_wait_ack(stream: &mut TcpStream, kind: &str, size: u64, filename: &str) -> Result<(), String> {
    let header = TransferHeader { magic: TRANSFER_MAGIC.into(), kind: kind.into(), size, filename: filename.into() };
    let data = serde_json::to_vec(&header).map_err(|e| e.to_string())?;
    let len: u32 = data.len() as u32;
    stream.write_all(&len.to_be_bytes()).map_err(|e| e.to_string())?;
    stream.write_all(&data).map_err(|e| e.to_string())?;
    stream.flush().ok();
    // Wait for small ACK "OK\n"
    stream.set_read_timeout(Some(Duration::from_secs(120))).ok();
    let mut ack = [0u8; 3];
    stream.read_exact(&mut ack).map_err(|e| e.to_string())?;
    if &ack != b"OK\n" { return Err("Receiver did not ACK".into()); }
    Ok(())
}

fn recv_header(stream: &mut TcpStream) -> Result<TransferHeader, String> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).map_err(|e| e.to_string())?;
    let len = u32::from_be_bytes(len_buf);
    let mut data = vec![0u8; len as usize];
    stream.read_exact(&mut data).map_err(|e| e.to_string())?;
    let header: TransferHeader = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    if header.magic != TRANSFER_MAGIC { return Err("Bad transfer header".into()); }
    Ok(header)
}

#[tauri::command]
pub fn start_receive_service(app: AppHandle) -> Result<String, String> {
    if LISTENING.swap(true, Ordering::SeqCst) {
        let _ = app.emit("share://recv_status", &serde_json::json!({"phase":"listening"}));
        return Ok("already".into());
    }
    let app_udp = app.clone();
    std::thread::spawn(move || {
        let udp = match UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)) { Ok(s) => s, Err(e) => { let _=app_udp.emit("share://recv_done", &serde_json::json!({"ok":false,"message":e.to_string()})); return; } };
        let _ = app_udp.emit("share://recv_status", &serde_json::json!({"phase":"listening"}));
        udp.set_read_timeout(Some(Duration::from_millis(1000))).ok();
        loop {
            let mut buf = [0u8; 2048];
            match udp.recv_from(&mut buf) {
                Ok((n, from)) => {
                    if let Ok(msg) = serde_json::from_slice::<DiscoveryPing>(&buf[..n]) {
                        if msg.magic == DISCOVERY_MAGIC && msg.kind == "ping" {
                            let pong = DiscoveryPing { magic: DISCOVERY_MAGIC.to_string(), kind: "pong".into(), name: host_name_fallback(), transfer_port: TRANSFER_PORT, id: Uuid::new_v4().to_string() };
                            let pong_bytes = serde_json::to_vec(&pong).unwrap_or_default();
                            let _ = udp.send_to(&pong_bytes, from);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {
                    // keep looping
                }
                Err(_) => { /* ignore */ }
            }
        }
    });

    let app_tcp = app.clone();
    std::thread::spawn(move || {
        let listener = match TcpListener::bind(("0.0.0.0", TRANSFER_PORT)) { Ok(l) => l, Err(e) => { let _=app_tcp.emit("share://recv_done", &serde_json::json!({"ok":false,"message":e.to_string()})); return; } };
        loop {
            match listener.accept() {
                Ok((mut stream, peer_addr)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(180)));
                    match recv_header(&mut stream) {
                        Ok(header) => {
                            let id = Uuid::new_v4().to_string();
                            {
                                let mut map = PENDING.lock().unwrap();
                                map.insert(id.clone(), PendingTransfer { stream: Some(stream), header: header.clone(), peer: peer_addr });
                            }
                            let _ = app_tcp.emit("share://recv_offer", &serde_json::json!({
                                "id": id,
                                "peer": peer_addr.to_string(),
                                "kind": header.kind,
                                "size": header.size,
                                "filename": header.filename
                            }));
                        }
                        Err(e) => {
                            let _ = app_tcp.emit("share://recv_done", &serde_json::json!({"ok":false,"message":format!("Bad header: {}", e)}));
                        }
                    }
                }
                Err(_) => { /* ignore transient */ }
            }
        }
    });

    Ok("started".into())
}

#[tauri::command]
pub fn accept_incoming_transfer(app: AppHandle, id: String, accept: bool) -> Result<(), String> {
    let notes_dir_path = notes_dir(&app)?;
    let mut map = PENDING.lock().unwrap();
    let mut pending = map.remove(&id).ok_or_else(|| "No such transfer".to_string())?;
    let mut stream = pending.stream.take().ok_or_else(|| "Stream missing".to_string())?;
    if !accept {
        let _ = stream.write_all(b"NO\n");
        let _ = app.emit("share://recv_done", &serde_json::json!({"ok":false,"message":"Rejected"}));
        return Ok(());
    }
    // ACK and receive
    stream.write_all(b"OK\n").map_err(|e| e.to_string())?;
    let zip_tmp = notes_dir_path.join("incoming_notes.zip");
    recv_file(&mut stream, &zip_tmp)?;
    let temp_extract = notes_dir_path.join("incoming_tmp");
    let _ = fs::remove_dir_all(&temp_extract);
    fs::create_dir_all(&temp_extract).map_err(|e| e.to_string())?;
    unzip_into(&temp_extract, &zip_tmp)?;
    let incoming_index_path = temp_extract.join("index.json");
    let incoming_index_str = fs::read_to_string(&incoming_index_path).map_err(|e| e.to_string())?;
    let incoming_index: Vec<StoredNoteMetadata> = serde_json::from_str(&incoming_index_str).map_err(|e| e.to_string())?;
    if let Ok(rd) = fs::read_dir(&temp_extract) {
        for entry in rd { if let Ok(entry) = entry { let path = entry.path(); if path.extension().and_then(|s| s.to_str()) == Some("md") { if let Some(file_name) = path.file_name() { let _ = fs::copy(&path, notes_dir_path.join(file_name)); } } } }
    }
    let dest_index_path = notes_dir_path.join("index.json");
    merge_index(&dest_index_path, &incoming_index)?;
    let _ = fs::remove_file(zip_tmp);
    let _ = fs::remove_dir_all(temp_extract);
    let _ = app.emit("share://recv_done", &serde_json::json!({"ok":true,"message":format!("Received {} bytes from {}", pending.header.size, pending.peer)}));
    Ok(())
}

#[tauri::command]
pub fn send_all_notes(app: AppHandle, wait_secs: Option<u64>) -> Result<String, String> {
    // 1) Broadcast discovery ping on all interfaces
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
    for addr in directed_broadcasts() {
        let _ = udp.send_to(&bytes, addr);
    }

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

#[tauri::command]
pub fn discover_receivers(wait_secs: Option<u64>) -> Result<Vec<PeerInfo>, String> {
    let timeout = wait_secs.unwrap_or(3);
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
    for addr in directed_broadcasts() { let _ = udp.send_to(&bytes, addr); }

    udp.set_read_timeout(Some(Duration::from_millis(500))).ok();
    let start = std::time::Instant::now();
    let mut peers: Vec<PeerInfo> = Vec::new();
    let mut seen = std::collections::HashSet::<String>::new();

    while start.elapsed() < Duration::from_secs(timeout) {
        let mut buf = [0u8; 2048];
        match udp.recv_from(&mut buf) {
            Ok((n, from)) => {
                if let Ok(msg) = serde_json::from_slice::<DiscoveryPing>(&buf[..n]) {
                    if msg.magic == DISCOVERY_MAGIC && msg.kind == "pong" {
                        let ip = from.ip().to_string();
                        if seen.insert(format!("{}:{}", ip, msg.transfer_port)) {
                            peers.push(PeerInfo { name: msg.name, ip, port: msg.transfer_port, id: msg.id });
                        }
                    }
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut {
                    // continue loop until total timeout
                } else {
                    break;
                }
            }
        }
    }
    Ok(peers)
}

fn send_zip_to(zip_path: &Path, ip: &str, port: u16) -> Result<String, String> {
    let target: SocketAddr = format!("{}:{}", ip, port).parse::<SocketAddr>().map_err(|e| e.to_string())?;
    let mut stream = TcpStream::connect(target).map_err(|e| e.to_string())?;
    let size = fs::metadata(zip_path).map_err(|e| e.to_string())?.len();
    send_header_and_wait_ack(&mut stream, "all", size, zip_path.file_name().and_then(|s| s.to_str()).unwrap_or("notes.zip"))?;
    send_file(&mut stream, zip_path)?;
    Ok(format!("Sent to {}", target))
}

#[tauri::command]
pub fn send_all_notes_to(app: AppHandle, ip: String, port: u16) -> Result<String, String> {
    let notes_dir_path = notes_dir(&app)?;
    let tmp_zip = notes_dir_path.join("outgoing_notes.zip");
    zip_notes_dir(&notes_dir_path, &tmp_zip)?;
    let res = send_zip_to(&tmp_zip, &ip, port);
    let _ = fs::remove_file(tmp_zip);
    res
}

#[tauri::command]
pub fn send_note_to(app: AppHandle, note_id: String, ip: String, port: u16) -> Result<String, String> {
    let notes_dir_path = notes_dir(&app)?;
    let tmp_zip = notes_dir_path.join("outgoing_single.zip");
    zip_single_note(&notes_dir_path, &note_id, &tmp_zip)?;
    let res = send_zip_to(&tmp_zip, &ip, port);
    let _ = fs::remove_file(tmp_zip);
    res
}

#[tauri::command]
pub fn start_send_all_notes_to(app: AppHandle, ip: String, port: u16) -> Result<(), String> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"preparing"}));
        let notes_dir_path = match notes_dir(&app_clone) { Ok(p)=>p, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); return; } };
        let tmp_zip = notes_dir_path.join("outgoing_notes.zip");
        if let Err(e) = zip_notes_dir(&notes_dir_path, &tmp_zip) { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); return; }
        let size = fs::metadata(&tmp_zip).ok().and_then(|m| Some(m.len())).unwrap_or(0);
        let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"connecting","bytes":size}));
        match TcpStream::connect(format!("{}:{}", ip, port)) {
            Ok(mut stream) => {
                let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"handshake"}));
                if let Err(e) = send_header_and_wait_ack(&mut stream, "all", size, "outgoing_notes.zip") { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); let _=fs::remove_file(&tmp_zip); return; }
                // stream file with progress
                let mut f = match fs::File::open(&tmp_zip){ Ok(f)=>f, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; } };
                if write_u64_be(&mut stream, size).is_err() { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":"Failed to write size"})); let _=fs::remove_file(&tmp_zip); return; }
                let mut buf = [0u8; 8192];
                let mut sent: u64 = 0;
                loop {
                    let n = match f.read(&mut buf) { Ok(n)=>n, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; } };
                    if n==0 { break; }
                    if let Err(e) = stream.write_all(&buf[..n]) { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; }
                    sent += n as u64;
                    let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"sending","sent":sent,"total":size}));
                }
                let _ = app_clone.emit("share://send_done", &serde_json::json!({"ok":true,"message":"Sent"}));
            }
            Err(e) => { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); }
        }
        let _ = fs::remove_file(&tmp_zip);
    });
    Ok(())
}

#[tauri::command]
pub fn start_send_note_to(app: AppHandle, note_id: String, ip: String, port: u16) -> Result<(), String> {
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"preparing"}));
        let notes_dir_path = match notes_dir(&app_clone) { Ok(p)=>p, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); return; } };
        let tmp_zip = notes_dir_path.join("outgoing_single.zip");
        if let Err(e) = zip_single_note(&notes_dir_path, &note_id, &tmp_zip) { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); return; }
        let size = fs::metadata(&tmp_zip).ok().and_then(|m| Some(m.len())).unwrap_or(0);
        let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"connecting","bytes":size}));
        match TcpStream::connect(format!("{}:{}", ip, port)) {
            Ok(mut stream) => {
                let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"handshake"}));
                if let Err(e) = send_header_and_wait_ack(&mut stream, "single", size, "outgoing_single.zip") { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e})); let _=fs::remove_file(&tmp_zip); return; }
                if write_u64_be(&mut stream, size).is_err() { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":"Failed to write size"})); let _=fs::remove_file(&tmp_zip); return; }
                let mut f = match fs::File::open(&tmp_zip){ Ok(f)=>f, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; } };
                let mut buf = [0u8; 8192];
                let mut sent: u64 = 0;
                loop {
                    let n = match f.read(&mut buf) { Ok(n)=>n, Err(e)=>{ let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; } };
                    if n==0 { break; }
                    if let Err(e) = stream.write_all(&buf[..n]) { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); let _=fs::remove_file(&tmp_zip); return; }
                    sent += n as u64;
                    let _ = app_clone.emit("share://send_status", &serde_json::json!({"phase":"sending","sent":sent,"total":size}));
                }
                let _ = app_clone.emit("share://send_done", &serde_json::json!({"ok":true,"message":"Sent"}));
            }
            Err(e) => { let _=app_clone.emit("share://send_done", &serde_json::json!({"ok":false,"message":e.to_string()})); }
        }
        let _ = fs::remove_file(&tmp_zip);
    });
    Ok(())
}
