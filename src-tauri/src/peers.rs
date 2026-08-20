use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;

use crate::protocol::{now_ms, PresenceStatus, PEER_TIMEOUT_MS};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub id: String,
    pub name: String,
    pub status: String,
    pub ip: String,
    pub port: u16,
    pub last_seen: u64,
}

#[derive(Default)]
pub struct PeerRegistry {
    peers: Mutex<HashMap<String, Peer>>,
}

impl PeerRegistry {
    pub fn upsert(
        &self,
        id: String,
        name: String,
        status: PresenceStatus,
        ip: String,
        port: u16,
    ) -> (Peer, bool) {
        let mut peers = self.peers.lock();
        let is_new = !peers.contains_key(&id);
        let peer = Peer {
            id: id.clone(),
            name,
            status: status.as_str().to_string(),
            ip,
            port,
            last_seen: now_ms(),
        };
        peers.insert(id, peer.clone());
        (peer, is_new)
    }

    pub fn get(&self, id: &str) -> Option<Peer> {
        self.peers.lock().get(id).cloned()
    }

    pub fn list(&self) -> Vec<Peer> {
        let mut peers: Vec<Peer> = self.peers.lock().values().cloned().collect();
        peers.sort_by(|a, b| {
            status_rank(&a.status)
                .cmp(&status_rank(&b.status))
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        peers
    }

    pub fn prune_stale(&self) -> Vec<Peer> {
        let cutoff = now_ms().saturating_sub(PEER_TIMEOUT_MS);
        let mut peers = self.peers.lock();
        let removed: Vec<Peer> = peers
            .values()
            .filter(|peer| peer.last_seen < cutoff)
            .cloned()
            .collect();
        for peer in &removed {
            peers.remove(&peer.id);
        }
        removed
    }
}

fn status_rank(status: &str) -> u8 {
    match status {
        "available" => 0,
        "focus" => 1,
        "busy" => 2,
        "away" => 3,
        _ => 4,
    }
}
