use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::{Mutex, RwLock};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::runtime::Runtime;
use uuid::Uuid;

use crate::discovery::{start_discovery, LocalIdentity};
use crate::peers::{Peer, PeerRegistry};
use crate::protocol::{
    build_ping, build_ping_ack, is_valid_display_name, is_valid_peer_id, now_ms, parse_tcp_message,
    PresenceStatus, TcpEnvelope, MAX_TCP_MESSAGE_BYTES, PING_ACK_TIMEOUT_MS,
    PING_CONNECT_TIMEOUT_MS, PING_EXPIRE_MS, PING_ID_CACHE_TTL_MS, PING_RATE_LIMIT_MS,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NetworkServiceState {
    Starting,
    Online,
    Degraded,
    Offline,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusDto {
    pub state: NetworkServiceState,
    pub detail: Option<String>,
    pub tcp_port: Option<u16>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingPingDto {
    pub id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub timestamp: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResultDto {
    pub peer_id: String,
    pub ping_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Clone)]
struct PendingIncoming {
    ping: IncomingPingDto,
    reply_ip: String,
    reply_port: u16,
}

#[derive(Default)]
struct SecurityGuards {
    seen_ping_ids: HashMap<String, u64>,
    last_ping_from_sender: HashMap<String, u64>,
}

impl SecurityGuards {
    fn prune(&mut self, now: u64) {
        self.seen_ping_ids
            .retain(|_, seen_at| now.saturating_sub(*seen_at) < PING_ID_CACHE_TTL_MS);
        self.last_ping_from_sender
            .retain(|_, seen_at| now.saturating_sub(*seen_at) < PING_ID_CACHE_TTL_MS);
    }

    /// Returns true if this ping should be processed.
    fn accept_incoming_ping(&mut self, ping_id: &str, sender_id: &str) -> bool {
        let now = now_ms();
        self.prune(now);

        if self.seen_ping_ids.contains_key(ping_id) {
            return false;
        }

        if let Some(last) = self.last_ping_from_sender.get(sender_id) {
            if now.saturating_sub(*last) < PING_RATE_LIMIT_MS {
                return false;
            }
        }

        self.seen_ping_ids.insert(ping_id.to_string(), now);
        self.last_ping_from_sender
            .insert(sender_id.to_string(), now);
        true
    }
}

pub struct NetworkState {
    runtime: Runtime,
    peers: Arc<PeerRegistry>,
    identity: Arc<RwLock<Option<LocalIdentity>>>,
    running: Arc<AtomicBool>,
    status: Arc<RwLock<NetworkStatusDto>>,
    pending_outgoing: Arc<Mutex<HashMap<String, String>>>,
    incoming: Arc<Mutex<Vec<PendingIncoming>>>,
    guards: Arc<Mutex<SecurityGuards>>,
}

impl NetworkState {
    pub fn new() -> Result<Self, String> {
        let runtime = Runtime::new().map_err(|e| format!("Failed to create async runtime: {e}"))?;
        Ok(Self {
            runtime,
            peers: Arc::new(PeerRegistry::default()),
            identity: Arc::new(RwLock::new(None)),
            running: Arc::new(AtomicBool::new(false)),
            status: Arc::new(RwLock::new(NetworkStatusDto {
                state: NetworkServiceState::Offline,
                detail: None,
                tcp_port: None,
            })),
            pending_outgoing: Arc::new(Mutex::new(HashMap::new())),
            incoming: Arc::new(Mutex::new(Vec::new())),
            guards: Arc::new(Mutex::new(SecurityGuards::default())),
        })
    }

    pub fn identity_snapshot(&self) -> Option<LocalIdentity> {
        self.identity.read().clone()
    }

    pub fn set_presence(&self, name: String, status: PresenceStatus) {
        if let Some(identity) = self.identity.write().as_mut() {
            identity.name = name;
            identity.status = status;
        }
    }
}

fn emit_status(app: &AppHandle, status: &Arc<RwLock<NetworkStatusDto>>, next: NetworkStatusDto) {
    *status.write() = next.clone();
    let _ = app.emit("network-status", &next);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartNetworkRequest {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[tauri::command]
pub fn start_network(
    app: AppHandle,
    state: State<'_, NetworkState>,
    profile: StartNetworkRequest,
) -> Result<NetworkStatusDto, String> {
    let status = PresenceStatus::parse(&profile.status)
        .ok_or_else(|| "Invalid presence status".to_string())?;
    if !is_valid_peer_id(&profile.id) {
        return Err("Invalid profile id".to_string());
    }
    if !is_valid_display_name(&profile.name) {
        return Err("Invalid profile name".to_string());
    }

    if state.running.load(Ordering::SeqCst) {
        if let Some(identity) = state.identity.write().as_mut() {
            identity.name = profile.name;
            identity.status = status;
        }
        let current = state.status.read().clone();
        let _ = app.emit("network-status", &current);
        return Ok(current);
    }

    emit_status(
        &app,
        &state.status,
        NetworkStatusDto {
            state: NetworkServiceState::Starting,
            detail: None,
            tcp_port: None,
        },
    );

    let listener = match state.runtime.block_on(TcpListener::bind("0.0.0.0:0")) {
        Ok(listener) => listener,
        Err(e) => {
            let dto = NetworkStatusDto {
                state: NetworkServiceState::Offline,
                detail: Some(format!("TCP listener unavailable: {e}")),
                tcp_port: None,
            };
            emit_status(&app, &state.status, dto.clone());
            return Ok(dto);
        }
    };

    let tcp_port = match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(e) => {
            let dto = NetworkStatusDto {
                state: NetworkServiceState::Offline,
                detail: Some(format!("Failed to read TCP port: {e}")),
                tcp_port: None,
            };
            emit_status(&app, &state.status, dto.clone());
            return Ok(dto);
        }
    };

    *state.identity.write() = Some(LocalIdentity {
        id: profile.id.clone(),
        name: profile.name.clone(),
        status: status.clone(),
        tcp_port,
    });
    state.running.store(true, Ordering::SeqCst);

    let discovery_result = start_discovery(
        app.clone(),
        Arc::clone(&state.identity),
        Arc::clone(&state.peers),
        Arc::clone(&state.running),
        Arc::clone(&state.status),
    );

    let service_status = match discovery_result {
        Ok(()) => NetworkStatusDto {
            state: NetworkServiceState::Online,
            detail: None,
            tcp_port: Some(tcp_port),
        },
        Err(err) => {
            eprintln!("[eskusmi] UDP discovery failed: {err}");
            NetworkStatusDto {
                state: NetworkServiceState::Degraded,
                detail: Some(err),
                tcp_port: Some(tcp_port),
            }
        }
    };
    emit_status(&app, &state.status, service_status.clone());
    crate::tray::sync_tray_status(&app, status);

    let app_tcp = app.clone();
    let peers = Arc::clone(&state.peers);
    let running = Arc::clone(&state.running);
    let incoming = Arc::clone(&state.incoming);
    let pending_outgoing = Arc::clone(&state.pending_outgoing);
    let guards = Arc::clone(&state.guards);
    let local_id = profile.id.clone();

    state.runtime.spawn(async move {
        accept_loop(
            listener,
            app_tcp,
            peers,
            running,
            incoming,
            pending_outgoing,
            guards,
            local_id,
        )
        .await;
    });

    let expire_app = app.clone();
    let expire_incoming = Arc::clone(&state.incoming);
    let expire_running = Arc::clone(&state.running);
    state.runtime.spawn(async move {
        while expire_running.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let now = now_ms();
            let mut incoming = expire_incoming.lock();
            let before = incoming.len();
            incoming.retain(|item| now.saturating_sub(item.ping.timestamp) < PING_EXPIRE_MS);
            if incoming.len() != before {
                let snapshot = incoming.iter().map(|i| i.ping.clone()).collect::<Vec<_>>();
                drop(incoming);
                let _ = expire_app.emit("incoming-pings", &snapshot);
            }
        }
    });

    Ok(service_status)
}

#[tauri::command]
pub fn get_network_status(state: State<'_, NetworkState>) -> Result<NetworkStatusDto, String> {
    Ok(state.status.read().clone())
}

#[tauri::command]
pub fn update_presence(
    app: AppHandle,
    state: State<'_, NetworkState>,
    name: String,
    status: String,
) -> Result<(), String> {
    let parsed = PresenceStatus::parse(&status).ok_or_else(|| "Invalid presence status".to_string())?;
    state.set_presence(name, parsed.clone());
    crate::tray::sync_tray_status(&app, parsed);
    Ok(())
}

#[tauri::command]
pub fn list_peers(state: State<'_, NetworkState>) -> Result<Vec<Peer>, String> {
    Ok(state.peers.list())
}

#[tauri::command]
pub fn ping_peer(
    app: AppHandle,
    state: State<'_, NetworkState>,
    peer_id: String,
) -> Result<(), String> {
    let local = state
        .identity
        .read()
        .clone()
        .ok_or_else(|| "Network not started".to_string())?;
    let peer = state
        .peers
        .get(&peer_id)
        .ok_or_else(|| "Peer not found".to_string())?;

    let ping_id = Uuid::new_v4().to_string();
    state
        .pending_outgoing
        .lock()
        .insert(ping_id.clone(), peer_id.clone());

    let _ = app.emit(
        "ping-result",
        PingResultDto {
            peer_id: peer_id.clone(),
            ping_id: ping_id.clone(),
            status: "sent".to_string(),
            message: "Ping sent".to_string(),
        },
    );

    let app2 = app.clone();
    let pending = Arc::clone(&state.pending_outgoing);
    let msg = build_ping(&ping_id, &local.id, &local.name);
    let addr = format!("{}:{}", peer.ip, peer.port);
    let peer_name = peer.name.clone();
    let peer_id_for_timeout = peer_id.clone();
    let ping_id_for_timeout = ping_id.clone();

    state.runtime.spawn(async move {
        match send_tcp_json(&addr, &msg).await {
            Ok(()) => {
                let _ = app2.emit(
                    "ping-result",
                    PingResultDto {
                        peer_id: peer_id.clone(),
                        ping_id: ping_id.clone(),
                        status: "waiting".to_string(),
                        message: "Waiting...".to_string(),
                    },
                );

                let pending_timeout = Arc::clone(&pending);
                let app_timeout = app2.clone();
                let peer_name_timeout = peer_name.clone();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(PING_ACK_TIMEOUT_MS)).await;
                    let removed = pending_timeout.lock().remove(&ping_id_for_timeout);
                    if removed.is_some() {
                        let _ = app_timeout.emit(
                            "ping-result",
                            PingResultDto {
                                peer_id: peer_id_for_timeout,
                                ping_id: ping_id_for_timeout,
                                status: "failed".to_string(),
                                message: format!("Couldn't reach {peer_name_timeout}"),
                            },
                        );
                    }
                });
            }
            Err(err) => {
                pending.lock().remove(&ping_id);
                let _ = app2.emit(
                    "ping-result",
                    PingResultDto {
                        peer_id,
                        ping_id,
                        status: "failed".to_string(),
                        message: format!("Couldn't reach {peer_name}"),
                    },
                );
                eprintln!("[eskusmi] ping failed for {peer_name}: {err}");
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn acknowledge_ping(
    app: AppHandle,
    state: State<'_, NetworkState>,
    ping_id: String,
) -> Result<(), String> {
    let local = state
        .identity
        .read()
        .clone()
        .ok_or_else(|| "Network not started".to_string())?;

    let pending = {
        let mut incoming = state.incoming.lock();
        let index = incoming
            .iter()
            .position(|item| item.ping.id == ping_id)
            .ok_or_else(|| "Incoming ping not found".to_string())?;
        incoming.remove(index)
    };

    let snapshot = state
        .incoming
        .lock()
        .iter()
        .map(|item| item.ping.clone())
        .collect::<Vec<_>>();
    let _ = app.emit("incoming-pings", &snapshot);

    let mut reply_ip = pending.reply_ip;
    let mut reply_port = pending.reply_port;
    if reply_port == 0 {
        if let Some(peer) = state.peers.get(&pending.ping.sender_id) {
            reply_ip = peer.ip;
            reply_port = peer.port;
        }
    }
    if reply_port == 0 {
        return Err("Cannot reply: sender communication port unknown".to_string());
    }

    let ack = build_ping_ack(&pending.ping.id, &local.id);
    let addr = format!("{reply_ip}:{reply_port}");
    state.runtime.spawn(async move {
        if let Err(err) = send_tcp_json(&addr, &ack).await {
            eprintln!("[eskusmi] Failed to send ping_ack: {err}");
        }
    });

    Ok(())
}

#[tauri::command]
pub fn list_incoming_pings(state: State<'_, NetworkState>) -> Result<Vec<IncomingPingDto>, String> {
    Ok(state
        .incoming
        .lock()
        .iter()
        .map(|item| item.ping.clone())
        .collect())
}

async fn accept_loop(
    listener: TcpListener,
    app: AppHandle,
    peers: Arc<PeerRegistry>,
    running: Arc<AtomicBool>,
    incoming: Arc<Mutex<Vec<PendingIncoming>>>,
    pending_outgoing: Arc<Mutex<HashMap<String, String>>>,
    guards: Arc<Mutex<SecurityGuards>>,
    local_id: String,
) {
    while running.load(Ordering::SeqCst) {
        match listener.accept().await {
            Ok((stream, addr)) => {
                let app = app.clone();
                let peers = Arc::clone(&peers);
                let incoming = Arc::clone(&incoming);
                let pending_outgoing = Arc::clone(&pending_outgoing);
                let guards = Arc::clone(&guards);
                let local_id = local_id.clone();
                tokio::spawn(async move {
                    if let Err(err) = handle_connection(
                        stream,
                        addr,
                        app,
                        peers,
                        incoming,
                        pending_outgoing,
                        guards,
                        local_id,
                    )
                    .await
                    {
                        eprintln!("[eskusmi] TCP connection error: {err}");
                    }
                });
            }
            Err(err) => {
                eprintln!("[eskusmi] TCP accept error: {err}");
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    addr: std::net::SocketAddr,
    app: AppHandle,
    peers: Arc<PeerRegistry>,
    incoming: Arc<Mutex<Vec<PendingIncoming>>>,
    pending_outgoing: Arc<Mutex<HashMap<String, String>>>,
    guards: Arc<Mutex<SecurityGuards>>,
    local_id: String,
) -> Result<(), String> {
    let limited = stream.take((MAX_TCP_MESSAGE_BYTES as u64) + 1);
    let mut reader = BufReader::new(limited);
    let mut line = String::new();
    let bytes = reader
        .read_line(&mut line)
        .await
        .map_err(|e| format!("read failed: {e}"))?;

    if bytes == 0 || line.len() > MAX_TCP_MESSAGE_BYTES {
        return Ok(());
    }

    let Some(message) = parse_tcp_message(&line) else {
        return Ok(());
    };

    match message {
        TcpEnvelope::Ping(ping) => {
            if ping.sender_id == local_id {
                return Ok(());
            }

            if !guards
                .lock()
                .accept_incoming_ping(&ping.id, &ping.sender_id)
            {
                return Ok(());
            }

            let known = peers.get(&ping.sender_id);
            let reply_ip = known
                .as_ref()
                .map(|peer| peer.ip.clone())
                .unwrap_or_else(|| addr.ip().to_string());
            let reply_port = known.as_ref().map(|peer| peer.port).unwrap_or(0);
            if reply_port == 0 {
                eprintln!(
                    "[eskusmi] Incoming ping from unknown peer {}; ack may fail until rediscovery",
                    ping.sender_id
                );
            }

            let dto = IncomingPingDto {
                id: ping.id,
                sender_id: ping.sender_id,
                sender_name: ping.sender_name,
                timestamp: now_ms(),
            };

            {
                let mut queue = incoming.lock();
                if !queue.iter().any(|item| item.ping.id == dto.id) {
                    queue.push(PendingIncoming {
                        ping: dto.clone(),
                        reply_ip,
                        reply_port,
                    });
                }
                let snapshot = queue.iter().map(|item| item.ping.clone()).collect::<Vec<_>>();
                drop(queue);
                let _ = app.emit("incoming-pings", &snapshot);
                let _ = app.emit("incoming-ping", &dto);
            }
        }
        TcpEnvelope::Ack(ack) => {
            let peer_id = pending_outgoing.lock().remove(&ack.ping_id);
            if let Some(peer_id) = peer_id {
                let _ = app.emit(
                    "ping-result",
                    PingResultDto {
                        peer_id,
                        ping_id: ack.ping_id,
                        status: "acknowledged".to_string(),
                        message: "Acknowledged".to_string(),
                    },
                );
            }
        }
    }

    Ok(())
}

async fn send_tcp_json<T: Serialize>(addr: &str, value: &T) -> Result<(), String> {
    let connect = TcpStream::connect(addr);
    let stream = tokio::time::timeout(Duration::from_millis(PING_CONNECT_TIMEOUT_MS), connect)
        .await
        .map_err(|_| "Connection timed out".to_string())?
        .map_err(|e| format!("Connect failed: {e}"))?;

    let mut stream = stream;
    let mut payload = serde_json::to_string(value).map_err(|e| e.to_string())?;
    if payload.len() > MAX_TCP_MESSAGE_BYTES {
        return Err("Payload too large".to_string());
    }
    payload.push('\n');
    stream
        .write_all(payload.as_bytes())
        .await
        .map_err(|e| format!("Write failed: {e}"))?;
    let _ = stream.shutdown().await;
    Ok(())
}
