"use client"
import { useState, useEffect } from "react"

interface Hand {
  cards: string[]
  total: number
  status: string
  result?: string
  bet?: number
  insurence?: number
}

interface PlayerData {
  status: number
  hands: Hand[]
  split1: Hand[]
  split1_status: number
  split2: Hand[]
  split2_status: number
}

interface Players {
  [key: string]: PlayerData
}

interface GameState {
  deck_count: number
  game_mode: string
  dealer: {
    cards: string[]
    total: number
    status: string
  }
  players: Players
  game_phase: string
  table_number: number
  current_turn: string
  selected_hand?: {
    player_id: string
    hand_index: number
    split_level: number
  }
  current_player?: string
  mode: string
  round_number: number
  evaluate_game: boolean
  manual_distribution_count: number
  next_manual_counter: number
}

export default function GameStatePage() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    const connect = () => {
      ws = new WebSocket("ws://localhost:6790");

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          reconnectTimeout = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.game_state) {
          setGameState(data.game_state);
        }
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Current Game State</h1>
      <div className="mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isConnected ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
      <pre className="bg-black/80 rounded-lg p-6 text-green-300 overflow-x-auto text-xs max-h-[80vh]">
        {gameState ? JSON.stringify(gameState, null, 2) : "Loading game state..."}
      </pre>
    </div>
  )
}
