use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use parking_lot::RwLock;
use tauri::{AppHandle, Emitter};

use crate::network::{NetworkServiceState, NetworkStatusDto};
use crate::peers::PeerRegistry;
use crate::protocol::{
    build_presence, parse_presence, PresenceStatus, HEARTBEAT_INTERVAL_MS, UDP_DISCOVERY_PORT,
};

#[derive(Clone)]
pub struct LocalIdentity {
    pub id: String,
    pub name: String,
    pub status: PresenceStatus,
    pub tcp_port: u16,
}

pub fn start_discovery(
    app: AppHandle,
    identity: Arc<RwLock<Option<LocalIdentity>>>,
    peers: Arc<PeerRegistry>,
    running: Arc<AtomicBool>,
    status: Arc<RwLock<NetworkStatusDto>>,
) -> Result<(), String> {
    let socket = UdpSocket::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, UDP_DISCOVERY_PORT)))
        .map_err(|e| format!("Failed to bind UDP discovery port {UDP_DISCOVERY_PORT}: {e}"))?;
    socket
        .set_broadcast(true)
        .map_err(|e| format!("Failed to enable UDP broadcast: {e}"))?;
    socket
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|e| format!("Failed to set UDP read timeout: {e}"))?;

    let broadcast_socket = socket
        .try_clone()
        .map_err(|e| format!("Failed to clone UDP socket: {e}"))?;

    let listen_running = Arc::clone(&running);
    let listen_identity = Arc::clone(&identity);
    let listen_peers = Arc::clone(&peers);
    let listen_app = app.clone();

    thread::spawn(move || {
        let mut buf = [0u8; 2048];
        while listen_running.load(Ordering::SeqCst) {
            match socket.recv_from(&mut buf) {
                Ok((len, addr)) => {
                    if len > 2048 {
                        continue;
                    }
                    if let Some(packet) = parse_presence(&buf[..len]) {
                        let local_id = listen_identity
                            .read()
                            .as_ref()
                            .map(|local| local.id.clone())
                            .unwrap_or_default();
                        if local_id.is_empty() || packet.id == local_id {
                            continue;
                        }

                        let Some(status) = PresenceStatus::parse(&packet.status) else {
                            continue;
                        };

                        let ip = match addr.ip() {
                            std::net::IpAddr::V4(v4) => v4.to_string(),
                            std::net::IpAddr::V6(v6) => v6.to_string(),
                        };

                        let (peer, is_new) = listen_peers.upsert(
                            packet.id,
                            packet.name,
                            status,
                            ip,
                            packet.port,
                        );

                        let event = if is_new {
                            "peer-discovered"
                        } else {
                            "peer-updated"
                        };
                        let _ = listen_app.emit(event, &peer);
                    }
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => {
                    eprintln!("[eskusmi] UDP recv error: {e}");
                    thread::sleep(Duration::from_millis(250));
                }
            }
        }
    });

    let beat_running = Arc::clone(&running);
    let beat_identity = Arc::clone(&identity);
    let beat_peers = Arc::clone(&peers);
    let beat_app = app;
    let beat_status = status;

    thread::spawn(move || {
        let mut consecutive_broadcast_errors = 0u32;
        while beat_running.load(Ordering::SeqCst) {
            if let Some(local) = beat_identity.read().clone() {
                let packet = build_presence(&local.id, &local.name, &local.status, local.tcp_port);
                if let Ok(bytes) = serde_json::to_vec(&packet) {
                    let target = SocketAddr::from((Ipv4Addr::BROADCAST, UDP_DISCOVERY_PORT));
                    if let Err(e) = broadcast_socket.send_to(&bytes, target) {
                        consecutive_broadcast_errors =
                            consecutive_broadcast_errors.saturating_add(1);
                        eprintln!("[eskusmi] UDP broadcast error: {e}");
                        if consecutive_broadcast_errors >= 3 {
                            let tcp_port = beat_status.read().tcp_port;
                            let next = NetworkStatusDto {
                                state: NetworkServiceState::Degraded,
                                detail: Some(format!("UDP broadcast failing: {e}")),
                                tcp_port,
                            };
                            *beat_status.write() = next.clone();
                            let _ = beat_app.emit("network-status", &next);
                        }
                    } else {
                        consecutive_broadcast_errors = 0;
                        let current = beat_status.read().clone();
                        if current.state == NetworkServiceState::Degraded
                            && current
                                .detail
                                .as_deref()
                                .is_some_and(|d| d.contains("UDP broadcast"))
                        {
                            let next = NetworkStatusDto {
                                state: NetworkServiceState::Online,
                                detail: None,
                                tcp_port: current.tcp_port,
                            };
                            *beat_status.write() = next.clone();
                            let _ = beat_app.emit("network-status", &next);
                        }
                    }
                }
            }

            let removed = beat_peers.prune_stale();
            for peer in removed {
                let _ = beat_app.emit("peer-removed", &peer);
            }

            thread::sleep(Duration::from_millis(HEARTBEAT_INTERVAL_MS));
        }
    });

    Ok(())
}
