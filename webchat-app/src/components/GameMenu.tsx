"use client";
import { useState, useEffect } from "react";
import WinnerModal from "@/components/WinnerModal";

const GameMenu = ({ socket }: { socket: WebSocket | null }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [mode, setMode] = useState<"manual" | "auto" | "live">("manual");
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableNumber, setTableNumber] = useState("1");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [gameState, setGameState] = useState({
    deck_count: 312,
    game_mode: "manual",
    dealer: { cards: [], total: 0, revealed: false, hidden_card: null, status: "waiting" },
    players: {},
    game_phase: "waiting",
    current_player: null,
    table_number: 1
  });

  // Handle WebSocket connection status
  useEffect(() => {
    if (!socket) {
      setConnectionStatus("disconnected");
      return;
    }

    const updateStatus = () => {
      switch (socket.readyState) {
        case WebSocket.OPEN:
          setConnectionStatus("connected");
          break;
        case WebSocket.CONNECTING:
          setConnectionStatus("connecting");
          break;
        default:
          setConnectionStatus("disconnected");
      }
    };

    // Set initial status
    updateStatus();

    // Add event listeners
    socket.addEventListener("open", updateStatus);
    socket.addEventListener("close", updateStatus);
    socket.addEventListener("error", updateStatus);

    return () => {
      socket.removeEventListener("open", updateStatus);
      socket.removeEventListener("close", updateStatus);
      socket.removeEventListener("error", updateStatus);
    };
  }, [socket]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received:", data);

        switch (data.action) {
          case "update_game_state":
          case "cards_dealt":
          case "player_hit":
          case "player_stand":
          case "player_split":
          case "player_double":
          case "player_surrender":
          case "dealer_hit":
          case "dealer_stand":
          case "dealer_revealed":
          case "round_reset":
          case "undo_completed":
            setGameState(data.game_state);
            break;
          case "mode_changed":
            setMode(data.mode);
            showMessage(data.message);
            break;
          case "deck_reshuffled":
            showMessage(data.message);
            break;
          case "player_added":
          case "player_removed":
            setGameState(prev => ({ ...prev, players: data.players }));
            showMessage(data.message || `Player ${data.action === 'player_added' ? 'added' : 'removed'}`);
            break;
          case "table_number_set":
            setTableNumber(data.table_number.toString());
            showMessage(`Table number set to ${data.table_number}`);
            break;
          case "error":
            showMessage(data.message, "error");
            break;
          default:
            console.warn("Unknown action:", data.action);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  const showMessage = (message: string, type: "success" | "error" = "success") => {
    setPopupMessage(message);
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000);
  };

  const sendAction = (action: string, data = {}) => {
    if (!socket) {
      showMessage("Not connected to server", "error");
      return false;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      showMessage("Connection not ready", "error");
      return false;
    }

    try {
      socket.send(JSON.stringify({ action, ...data }));
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      showMessage("Failed to send action", "error");
      return false;
    }
  };

  const setGameMode = (newMode: "manual" | "auto" | "live") => {
    if (sendAction("set_game_mode", { mode: newMode })) {
      setMode(newMode);
    }
  };

  const addPlayer = () => {
    if (Object.keys(gameState.players).length >= 6) {
      showMessage("Maximum players reached (6)", "error");
      return;
    }
    sendAction("add_player");
  };

  const removePlayer = (playerId: string) => {
    sendAction("remove_player", { player_id: playerId });
  };

  const dealCards = () => sendAction("deal_cards");
  const hitPlayer = (playerId: string, handIndex = 0) => sendAction("hit_player", { player_id: playerId, hand_index: handIndex });
  const standPlayer = (playerId: string, handIndex = 0) => sendAction("stand_player", { player_id: playerId, hand_index: handIndex });
  const splitPlayer = (playerId: string) => sendAction("split_player", { player_id: playerId });
  const doublePlayer = (playerId: string, handIndex = 0) => sendAction("double_player", { player_id: playerId, hand_index: handIndex });
  const surrenderPlayer = (playerId: string) => sendAction("surrender_player", { player_id: playerId });
  const hitDealer = () => sendAction("hit_dealer");
  const standDealer = () => sendAction("stand_dealer");
  const revealDealer = () => sendAction("reveal_dealer");
  const autoPlay = () => sendAction("auto_play");
  const resetRound = () => sendAction("reset_round");
  const undoLast = () => sendAction("undo_last");
  const reshuffle = () => sendAction("reshuffle");

  const sendTableNumber = () => {
    const tableNum = parseInt(tableNumber);
    if (isNaN(tableNum) || tableNum < 1) {
      showMessage("Invalid table number", "error");
      return;
    }
    if (sendAction("set_table_number", { table_number: tableNum })) {
      setShowTableModal(false);
    }
  };

  const suits = [
    { symbol: "♠", value: "S" },
    { symbol: "♦", value: "D" },
    { symbol: "♣", value: "C" },
    { symbol: "♥", value: "H" },
  ];

  const getPlayerIds = () => Object.keys(gameState.players);

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between w-full h-30 shadow-lg bg-gradient-to-r from-green-800 to-green-900">
        {/* Left Section */}
        <div className="font-mono p-4 rounded-lg shadow-lg text-left md:w-1/4 w-full relative">
          <div className="flex-col justify-center items-center">
            <div className="flex justify-center items-center">
              <div className="text-2xl font-bold text-yellow-300">♠ BLACKJACK ♠</div>
            </div>
            <div className="text-xl text-center text-yellow-300">Table BJ{tableNumber}</div>
            <div className="text-sm text-center text-gray-300">
              Deck: {gameState.deck_count} cards | Mode: {gameState.game_mode.toUpperCase()}
            </div>
            <div className={`text-xs text-center mt-1 ${
              connectionStatus === "connected" ? "text-green-400" : 
              connectionStatus === "connecting" ? "text-yellow-400" : "text-red-400"
            }`}>
              {connectionStatus.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Middle Section - Player Status */}
        <div className="flex py-5 border border-yellow-600 px-5 gap-3 overflow-x-auto">
          {Array.from({ length: 6 }, (_, i) => {
            const playerId = `player${i + 1}`;
            const isActive = playerId in gameState.players;
            return (
              <div key={playerId} className="flex flex-col items-center">
                <img
                  src={isActive ? "/assets/whitehat.png" : "/assets/redhat.png"}
                  alt={`Player ${i + 1}`}
                  className="h-16 cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => isActive ? removePlayer(playerId) : addPlayer()}
                />
                <span className="text-xs text-yellow-300 mt-1">P{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Right Section with Menu */}
        <div className="font-mono p-4 rounded-lg shadow-lg text-left md:w-1/4 w-full relative">
          <div className="flex-col justify-center items-center relative">
            <div className="flex justify-center items-center cursor-pointer">
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen(!menuOpen)} 
                  className="hover:scale-110 transition-transform"
                  disabled={connectionStatus !== "connected"}
                >
                  <div className={`rounded-full p-4 text-black font-bold text-xl ${
                    connectionStatus === "connected" ? "bg-yellow-600 hover:bg-yellow-500" : "bg-gray-500 cursor-not-allowed"
                  }`}>
                    CONTROLS
                  </div>
                </button>

                {menuOpen && (
                  <div className="fixed inset-0 left-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4 w-full">
                    <div className="relative bg-gray-900 text-white w-full max-w-6xl rounded-lg p-6 grid grid-cols-4 gap-4 max-h-[90vh] overflow-y-auto">
                      {/* Close Button */}
                      <button
                        onClick={() => setMenuOpen(false)}
                        className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-500"
                      >
                        ×
                      </button>

                      {showPopup && (
                        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
                          popupMessage.includes("error") || popupMessage.includes("Error") ? "bg-red-500" : "bg-green-500"
                        } text-white`}>
                          {popupMessage}
                        </div>
                      )}

                      {/* Connection Status */}
                      <div className="col-span-4 text-center">
                        <div className={`inline-block px-4 py-2 rounded-full ${
                          connectionStatus === "connected" ? "bg-green-600" : 
                          connectionStatus === "connecting" ? "bg-yellow-600" : "bg-red-600"
                        }`}>
                          {connectionStatus.toUpperCase()}
                        </div>
                      </div>

                      {/* Mode Selection */}
                      <div className="col-span-4 flex justify-center mb-4">
                        <div className="flex bg-gray-700 rounded-lg overflow-hidden">
                          {["live", "manual", "auto"].map((modeOption) => (
                            <button
                              key={modeOption}
                              onClick={() => setGameMode(modeOption as "manual" | "auto" | "live")}
                              className={`px-6 py-3 font-bold ${
                                mode === modeOption 
                                  ? "bg-blue-500 text-white" 
                                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                              }`}
                              disabled={connectionStatus !== "connected"}
                            >
                              {modeOption.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Game Controls */}
                      <div className="col-span-1">
                        <h3 className="text-lg font-bold mb-3 text-yellow-300">Game Control</h3>
                        <div className="space-y-2">
                          <button 
                            onClick={dealCards} 
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected"}
                          >
                            DEAL CARDS
                          </button>
                          <button 
                            onClick={resetRound} 
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected"}
                          >
                            RESET ROUND
                          </button>
                          <button 
                            onClick={reshuffle} 
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected"}
                          >
                            RESHUFFLE DECK
                          </button>
                          <button 
                            onClick={undoLast} 
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected"}
                          >
                            UNDO LAST
                          </button>
                          <button
                            onClick={() => setShowTableModal(true)}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected"}
                          >
                            TABLE NUMBER
                          </button>
                        </div>
                      </div>

                      {/* Dealer Controls */}
                      <div className="col-span-1">
                        <h3 className="text-lg font-bold mb-3 text-yellow-300">Dealer</h3>
                        <div className="space-y-2">
                          <button 
                            onClick={revealDealer} 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected" || gameState.dealer.revealed}
                          >
                            REVEAL CARD
                          </button>
                          <button 
                            onClick={hitDealer} 
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected" || gameState.dealer.status !== "playing"}
                          >
                            HIT DEALER
                          </button>
                          <button 
                            onClick={standDealer} 
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected" || gameState.dealer.status !== "playing"}
                          >
                            STAND DEALER
                          </button>
                          {mode === "auto" && (
                            <button 
                              onClick={autoPlay} 
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                              disabled={connectionStatus !== "connected"}
                            >
                              AUTO PLAY
                            </button>
                          )}
                        </div>
                        
                        <div className="mt-4 p-3 bg-gray-800 rounded">
                          <div className="text-sm">
                            <div>Cards: {gameState.dealer.cards.length}</div>
                            <div>Total: {gameState.dealer.total}</div>
                            <div>Status: {gameState.dealer.status}</div>
                            {gameState.dealer.hidden_card && !gameState.dealer.revealed && (
                              <div className="text-yellow-300">Hidden card present</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Player Controls */}
                      <div className="col-span-1">
                        <h3 className="text-lg font-bold mb-3 text-yellow-300">Players</h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {Object.entries(gameState.players).map(([playerId, playerData]: [string, any]) => (
                            <div key={playerId} className="bg-gray-800 p-3 rounded">
                              <div className="font-bold mb-2">{playerId.toUpperCase()}</div>
                              <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                                <button 
                                  onClick={() => hitPlayer(playerId)} 
                                  className="bg-green-500 hover:bg-green-600 px-2 py-1 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
                                  disabled={connectionStatus !== "connected" || playerData.status !== "playing"}
                                >
                                  HIT
                                </button>
                                <button 
                                  onClick={() => standPlayer(playerId)} 
                                  className="bg-red-500 hover:bg-red-600 px-2 py-1 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
                                  disabled={connectionStatus !== "connected" || playerData.status !== "playing"}
                                >
                                  STAND
                                </button>
                                <button 
                                  onClick={() => splitPlayer(playerId)} 
                                  className="bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
                                  disabled={connectionStatus !== "connected" || playerData.status !== "playing" || !canSplit(playerData.hands[0]?.cards)}
                                >
                                  SPLIT
                                </button>
                                <button 
                                  onClick={() => doublePlayer(playerId)} 
                                  className="bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded disabled:bg-gray-500 disabled:cursor-not-allowed"
                                  disabled={connectionStatus !== "connected" || playerData.status !== "playing" || playerData.hands[0]?.cards?.length !== 2}
                                >
                                  DOUBLE
                                </button>
                                <button 
                                  onClick={() => surrenderPlayer(playerId)} 
                                  className="bg-purple-500 hover:bg-purple-600 px-2 py-1 rounded col-span-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
                                  disabled={connectionStatus !== "connected" || playerData.status !== "playing" || playerData.hands[0]?.cards?.length !== 2}
                                >
                                  SURRENDER
                                </button>
                              </div>
                              <div className="text-xs text-gray-300">
                                <div>Hands: {playerData.hands?.length || 0}</div>
                                <div>Status: {playerData.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="col-span-1">
                        <h3 className="text-lg font-bold mb-3 text-yellow-300">Quick Actions</h3>
                        <div className="space-y-2">
                          <button 
                            onClick={addPlayer} 
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={connectionStatus !== "connected" || Object.keys(gameState.players).length >= 6}
                          >
                            ADD PLAYER
                          </button>
                          <div className="text-sm text-gray-300 mt-4">
                            <div>Active Players: {Object.keys(gameState.players).length}/6</div>
                            <div>Game Phase: {gameState.game_phase}</div>
                            <div>Current Player: {gameState.current_player || "None"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Table Number Modal */}
                      {showTableModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
                          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96 text-center">
                            <h2 className="text-xl font-bold mb-4 text-white">Enter Table Number</h2>
                            <input
                              type="number"
                              value={tableNumber}
                              onChange={(e) => setTableNumber(e.target.value)}
                              className="border p-2 w-full rounded-md text-center text-black"
                              placeholder="Enter Table Number"
                              min="1"
                            />
                            <div className="flex justify-between mt-4">
                              <button
                                onClick={() => setShowTableModal(false)}
                                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={sendTableNumber}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GameMenu;