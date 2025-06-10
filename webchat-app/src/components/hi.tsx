"use client";
import { useState, useEffect } from 'react';

interface GameState {
  deck_count: number;
  game_mode: string;
  dealer: {
    cards: string[];
    total: number;
    revealed: boolean;
    hidden_card: string | null;
    status: string;
  };
  players: Record<string, any>;
  game_phase: string;
  current_player: string | null;
  table_number: number;
}

export default function BlackjackInterface() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [status, setStatus] = useState("Disconnected");
  const [message, setMessage] = useState("");

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:6790");

    ws.onopen = () => {
      setSocket(ws);
      setStatus("Connected");
      setMessage("Connected to Blackjack server");
    };

    ws.onclose = () => {
      setStatus("Disconnected");
      setMessage("Connection closed");
    };

    ws.onerror = (error) => {
      setStatus("Error");
      setMessage(`Connection error: ${error}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "update_game_state" || data.game_state) {
          setGameState(data.game_state);
        }
        if (data.message) {
          setMessage(data.message);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const sendAction = (action: string, data: any = {}) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action, ...data }));
    } else {
      setMessage("Cannot send - connection not ready");
    }
  };

  // Basic game actions
  const addPlayer = () => sendAction("handle_add_player");
  const dealCards = () => sendAction("deal_cards");
  const hitPlayer = (playerId: string) => sendAction("hit_player", { player_id: playerId });
  const standPlayer = (playerId: string) => sendAction("stand_player", { player_id: playerId });
  const revealDealer = () => sendAction("reveal_dealer");
  const resetRound = () => sendAction("reset_round");

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-4">Blackjack Controller</h1>
        
        {/* Connection status */}
        <div className={`p-3 mb-4 rounded ${
          status === "Connected" ? 'bg-green-100 text-green-800' : 
          status === "Disconnected" ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          Status: {status} | {message}
        </div>

        {/* Game info */}
        {gameState && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <h2 className="font-bold mb-2">Table Info</h2>
              <p>Mode: {gameState.game_mode}</p>
              <p>Phase: {gameState.game_phase}</p>
              <p>Deck: {gameState.deck_count} cards</p>
              <p>Players: {Object.keys(gameState.players).length}/6</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <h2 className="font-bold mb-2">Dealer</h2>
              <p>Cards: {gameState.dealer.cards.length}</p>
              <p>Total: {gameState.dealer.total}</p>
              <p>Status: {gameState.dealer.status}</p>
              {gameState.dealer.hidden_card && !gameState.dealer.revealed && (
                <p className="text-yellow-600">Hidden card</p>
              )}
            </div>
          </div>
        )}

        {/* Player controls */}
        <div className="mb-6">
          <h2 className="font-bold mb-2">Player Management</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={addPlayer}
              disabled={!socket || !gameState || Object.keys(gameState.players).length >= 6}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Add Player
            </button>
            
            <button
              onClick={dealCards}
              disabled={!socket || !gameState || Object.keys(gameState.players).length === 0}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Deal Cards
            </button>
            
            <button
              onClick={resetRound}
              disabled={!socket}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Reset Round
            </button>
          </div>
        </div>

        {/* Player actions */}
        {gameState && Object.keys(gameState.players).length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold mb-2">Player Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(gameState.players).map((playerId) => (
                <div key={playerId} className="bg-gray-50 p-4 rounded">
                  <h3 className="font-bold">{playerId}</h3>
                  <p>Status: {gameState.players[playerId].status}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => hitPlayer(playerId)}
                      disabled={gameState.players[playerId].status !== "playing"}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-sm rounded disabled:bg-gray-300"
                    >
                      Hit
                    </button>
                    <button
                      onClick={() => standPlayer(playerId)}
                      disabled={gameState.players[playerId].status !== "playing"}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-sm rounded disabled:bg-gray-300"
                    >
                      Stand
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dealer actions */}
        {gameState && gameState.game_phase === "playing" && (
          <div className="mb-6">
            <h2 className="font-bold mb-2">Dealer Actions</h2>
            <button
              onClick={revealDealer}
              disabled={gameState.dealer.revealed}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:bg-gray-300"
            >
              Reveal Dealer Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}