"use client"
import { useState, useEffect } from "react"

interface Hand {
  cards: string[]
  total: number
  status: string
  result?: string
  bet?: number
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
    revealed: boolean
    hidden_card: string | null
    status: string
  }
  players: Players
  game_phase: string
  current_player: string | null
  table_number: number
  current_turn: string
  selected_hand?: {
    player_id: string
    hand_index: number
    split_level: number
  }
}

// Add these helper functions at the top of the file, after the interfaces
const isHandSelected = (gameState: GameState | null, playerId: string, handIndex: number, splitLevel: number): boolean => {
  if (!gameState?.selected_hand) return false;
  return gameState.selected_hand.player_id === playerId && 
         gameState.selected_hand.hand_index === handIndex && 
         gameState.selected_hand.split_level === splitLevel;
};

const DebugPanel = ({ gameState }: { gameState: GameState | null }) => {
  if (!gameState) return null;

  // Group players into rows of 3
  const playerEntries = Object.entries(gameState.players);
  const playerRows = [];
  for (let i = 0; i < playerEntries.length; i += 3) {
    playerRows.push(playerEntries.slice(i, i + 3));
  }

  return (
    <div className="fixed bottom-0 right-0 w-[80vw] h-[80vh] bg-gray-900/95 p-4 overflow-y-auto border-l border-gray-700">
      <h2 className="text-xl font-bold text-yellow-400 mb-4">Backend Information</h2>
      
      {/* Complete Game State */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">Complete Game State</h3>
        <pre className="bg-gray-800 p-4 rounded text-sm overflow-x-auto">
          {JSON.stringify(gameState, null, 2)}
        </pre>
      </div>

      {/* Game State Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">Game State Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Game Phase:</span> {gameState.game_phase}</p>
            <p><span className="text-gray-400">Game Mode:</span> {gameState.game_mode}</p>
            <p><span className="text-gray-400">Current Player:</span> {gameState.current_player || 'None'}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Selected Player:</span> {gameState.selected_hand?.player_id || 'None'}</p>
            <p><span className="text-gray-400">Table Number:</span> {gameState.table_number}</p>
            <p><span className="text-gray-400">Deck Count:</span> {gameState.deck_count}</p>
          </div>
        </div>
      </div>

      {/* Dealer State */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">Dealer State</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Status:</span> {gameState.dealer.status}</p>
            <p><span className="text-gray-400">Total:</span> {gameState.dealer.total}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Cards:</span> {gameState.dealer.cards?.join(', ') || 'None'}</p>
            <p><span className="text-gray-400">Hidden Card:</span> {gameState.dealer.hidden_card || 'None'}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Revealed:</span> {gameState.dealer.revealed ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      {/* Players State */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">Players State</h3>
        <div className="space-y-6">
          {playerRows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-3 gap-4">
              {row.map(([playerId, playerData]) => {
                const isCurrentHand = gameState?.selected_hand?.player_id === playerId && 
                                     gameState?.selected_hand?.hand_index === 0 && 
                                     gameState?.selected_hand?.split_level === 0;

                const isCurrentSplit1Hand = gameState?.selected_hand?.player_id === playerId && 
                                          gameState?.selected_hand?.hand_index === 0 && 
                                          gameState?.selected_hand?.split_level === 1;

                const isCurrentSplit2Hand = gameState?.selected_hand?.player_id === playerId && 
                                          gameState?.selected_hand?.hand_index === 0 && 
                                          gameState?.selected_hand?.split_level === 2;

                const isCurrentPlayer = gameState?.current_player === playerId && gameState?.current_turn === "player"
                const isActive = playerData.status === 1
                return (
                  <div
                    key={playerId}
                    className={`p-5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
                      isCurrentHand
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                        : isActive
                          ? "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30"
                          : "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isActive) {
                        handlePlayerClick(playerId)
                      }
                    }}
                  >
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-4 h-4 rounded-full shadow-lg ${
                              isCurrentHand
                                ? "bg-yellow-400 animate-pulse"
                                : isCurrentPlayer
                                  ? "bg-green-400 animate-pulse"
                                  : "bg-gray-400"
                            }`}
                          />
                          <div>
                            <div className={`text-lg font-bold ${isCurrentHand ? "text-gray-900" : isCurrentPlayer ? "text-gray-900" : "text-white"}`}>
                              {playerId.replace("player", "Player ")}
                            </div>
                            <div className={`text-sm ${isCurrentHand ? "text-gray-700" : isCurrentPlayer ? "text-gray-700" : "opacity-75"}`}>
                              {isCurrentHand ? "Current Hand" : isCurrentPlayer ? "Current Turn" : isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        </div>
                        {!isActive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              activatePlayer(playerId)
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Activate</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deactivatePlayer(playerId)
                            }}
                            className={`px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium ${
                              isCurrentHand
                                ? "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"
                                : isCurrentPlayer
                                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"
                                  : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Deactivate</span>
                          </button>
                        )}
                      </div>

                      {isActive && (
                        <div className="space-y-4">
                          {/* Cards Display */}
                          <div className={`rounded-lg p-3 ${isHandSelected(gameState, playerId, 0, 0) ? "bg-yellow-500/20" : "bg-black/20"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className={`text-sm font-medium ${isCurrentHand ? "text-gray-900" : "text-white"}`}>
                                Cards:
                              </div>
                            </div>
                            <div className="flex space-x-2 mb-2">
                              {gameState?.players?.[playerId]?.hands?.[0]?.cards?.map((card: string, index: number) => (
                                <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                  <img
                                    src={`/cards/${card}.png`}
                                    alt={card}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src = "/cards/back.png"
                                    }}
                                  />
                                </div>
                              ))}
                              {/* Empty card slots */}
                              {[
                                ...Array(Math.max(0, 2 - (gameState?.players?.[playerId]?.hands?.[0]?.cards?.length ?? 0))),
                              ].map((_, index) => (
                                <div
                                  key={`empty-${index}`}
                                  className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                    isCurrentHand
                                      ? "border-yellow-400/50 bg-yellow-500/10"
                                      : "border-gray-400 bg-gray-800/50"
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span
                                className={`text-lg font-bold ${
                                  (gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0) > 21
                                    ? "text-red-500"
                                    : isCurrentHand
                                      ? "text-gray-900"
                                      : "text-blue-400"
                                }`}
                              >
                                {gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0}
                              </span>
                              <div className="flex space-x-2">
                                {gameState?.players?.[playerId]?.hands?.[0]?.status === "playing" && (
                                  <>
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                    >
                                      Hit
                                    </button>
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                      className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                    >
                                      Double
                                    </button>
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    >
                                      Stand
                                    </button>
                                  </>
                                )}
                                {gameState?.players?.[playerId]?.hands?.[0]?.cards.length === 2 &&
                                  gameState?.players?.[playerId]?.hands?.[0]?.cards?.[0]?.[0] === gameState?.players?.[playerId]?.hands?.[0]?.cards?.[1]?.[0] && 
                                  gameState?.players?.[playerId]?.hands?.[0]?.status === "playing" && (
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                      className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                    >
                                      Split
                                    </button>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Split1 Hands Display */}
                          {gameState?.players?.[playerId]?.split1?.[0]?.cards?.length > 0 && (
                            <div className="mt-4 border-t border-gray-300 pt-3">
                              <div className="text-sm font-medium text-gray-400 mb-2">Split 1:</div>
                              <div className={`rounded-lg p-3 ${isHandSelected(gameState, playerId, 0, 1) ? "bg-yellow-500/20" : "bg-black/20"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`text-sm font-medium ${isCurrentSplit1Hand ? "text-gray-900" : "text-white"}`}>
                                    Cards:
                                  </div>
                                </div>
                                <div className="flex space-x-2 mb-2">
                                  {gameState.players[playerId].split1[0].cards.map((card, index) => (
                                    <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                      <img
                                        src={`/cards/${card}.png`}
                                        alt={card}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement
                                          target.src = "/cards/back.png"
                                        }}
                                      />
                                    </div>
                                  ))}
                                  {/* Empty card slots */}
                                  {[...Array(Math.max(0, 2 - (gameState.players[playerId].split1[0].cards.length ?? 0)))].map((_, index) => (
                                    <div
                                      key={`empty-${index}`}
                                      className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                        isCurrentSplit1Hand
                                          ? "border-yellow-400/50 bg-yellow-500/10"
                                          : "border-gray-400 bg-gray-800/50"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span
                                    className={`text-lg font-bold ${
                                      (gameState.players[playerId].split1[0].total ?? 0) > 21
                                        ? "text-red-500"
                                        : isCurrentSplit1Hand
                                          ? "text-gray-900"
                                          : "text-blue-400"
                                    }`}
                                  >
                                    {gameState.players[playerId].split1[0].total ?? 0}
                                  </span>
                                  <div className="flex space-x-2">
                                    {gameState.players[playerId].split1[0].status === "playing" && (
                                      <>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        >
                                          Hit
                                        </button>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                        >
                                          Double
                                        </button>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        >
                                          Stand
                                        </button>
                                      </>
                                    )}
                                    {gameState.players[playerId].split1[0].cards.length === 2 &&
                                      gameState.players[playerId].split1[0].cards[0][0] === gameState.players[playerId].split1[0].cards[1][0] &&
                                      gameState.players[playerId].split1[0].status === "playing" && (
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                        >
                                          Split
                                        </button>
                                      )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Split2 Hands Display */}
                          {gameState?.players?.[playerId]?.split2?.[0]?.cards?.length > 0 && (
                            <div className="mt-4 border-t border-gray-300 pt-3">
                              <div className="text-sm font-medium text-gray-400 mb-2">Split 2:</div>
                              <div className={`rounded-lg p-3 ${isHandSelected(gameState, playerId, 0, 2) ? "bg-yellow-500/20" : "bg-black/20"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className={`text-sm font-medium ${isCurrentSplit2Hand ? "text-gray-900" : "text-white"}`}>
                                    Cards:
                                  </div>
                                </div>
                                <div className="flex space-x-2 mb-2">
                                  {gameState.players[playerId].split2[0].cards.map((card, index) => (
                                    <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                      <img
                                        src={`/cards/${card}.png`}
                                        alt={card}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement
                                          target.src = "/cards/back.png"
                                        }}
                                      />
                                    </div>
                                  ))}
                                  {/* Empty card slots */}
                                  {[...Array(Math.max(0, 2 - (gameState.players[playerId].split2[0].cards.length ?? 0)))].map((_, index) => (
                                    <div
                                      key={`empty-${index}`}
                                      className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                        isCurrentSplit2Hand
                                          ? "border-yellow-400/50 bg-yellow-500/10"
                                          : "border-gray-400 bg-gray-800/50"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span
                                    className={`text-lg font-bold ${
                                      (gameState.players[playerId].split2[0].total ?? 0) > 21
                                        ? "text-red-500"
                                        : isCurrentSplit2Hand
                                          ? "text-gray-900"
                                          : "text-blue-400"
                                    }`}
                                  >
                                    {gameState.players[playerId].split2[0].total ?? 0}
                                  </span>
                                  <div className="flex space-x-2">
                                    {gameState.players[playerId].split2[0].status === "playing" && (
                                      <>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                        >
                                          Hit
                                        </button>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                        >
                                          Double
                                        </button>
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                        >
                                          Stand
                                        </button>
                                      </>
                                    )}
                                    {gameState.players[playerId].split2[0].cards.length === 2 &&
                                      gameState.players[playerId].split2[0].cards[0][0] === gameState.players[playerId].split2[0].cards[1][0] &&
                                      gameState.players[playerId].split2[0].status === "playing" && (
                                        <button
                                          onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                          className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                        >
                                          Split
                                        </button>
                                      )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Next Button - Show for current player */}
                    {isActive && isCurrentPlayer && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNextTurn()
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                          <span>Next</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GameMenu = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isRoundFinished, setIsRoundFinished] = useState(false)
  const [showNextButton, setShowNextButton] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [popupMessage, setPopupMessage] = useState("")
  const [isDealerSelected, setIsDealerSelected] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    const connect = () => {
      ws = new WebSocket("ws://localhost:6790");

      ws.onopen = () => {
        console.log("Connected to server");
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      ws.onclose = () => {
        console.log("Disconnected from server");
        setIsConnected(false);
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectTimeout = setTimeout(connect, RECONNECT_DELAY);
        } else {
          console.log("Max reconnection attempts reached");
          setPopupMessage("⚠️ Connection lost. Please refresh the page.");
          setShowPopup(true);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setPopupMessage("⚠️ Connection error occurred");
        setShowPopup(true);
      };

      ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
        console.log("Received:", data);

        // Update game state for all relevant actions
        if (data.game_state) {
          setGameState(data.game_state);
        }

        // Handle specific actions
        switch (data.action) {
          case "player_activated":
            setPopupMessage(data.message);
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1000);
            break;
          case "player_removed":
            setPopupMessage(data.message);
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1000);
            break;
          case "turn_updated":
            setIsDealerSelected(data.current_turn === "dealer");
            break;
          case "game_started":
            setIsPlaying(true);
            setIsGameStarted(true);
            setIsRoundFinished(false);
            setShowNextButton(true);
            setIsDealerSelected(data.current_turn === "dealer");
            break;
          case "round_reset":
            setIsPlaying(false);
            setIsGameStarted(false);
            setIsDealerSelected(false);
            setShowNextButton(false);
            setIsRoundFinished(true);
            break;
          case "game_reset":
            // Reset all local state
            setIsPlaying(false);
            setIsGameStarted(false);
            setIsRoundFinished(false);
            setShowNextButton(false);
            setIsDealerSelected(false);
            setSelectedCard(null);
            setSelectedSuit(null);
            setPopupMessage(data.message);
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 3000);
            break;
          case "error":
            setPopupMessage(data.message);
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 1000);
            break;
        }
      };

      setSocket(ws);
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const handleMainContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Only clear dealer selection, player selection is managed by backend
      setIsDealerSelected(false)
    }
  }

  const activatePlayer = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send selection to backend first
    sendWebSocketMessage({
      action: "select_player",
      player_id: playerId
    })

    // Then activate the player
    sendWebSocketMessage({
      action: "activate_player",
      player_id: playerId
    })
  }

  const deactivatePlayer = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Clear selection if deactivating selected player
    if (gameState?.selected_hand?.player_id === playerId) {
      sendWebSocketMessage({
        action: "select_player",
        player_id: null
      })
    }

    sendWebSocketMessage({
      action: "remove_player",
      player_id: playerId
    })
  }

  const handlePlayerClick = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send selection to backend
    sendWebSocketMessage({
      action: "select_player",
      player_id: playerId
    })
  }

  const startGameLoop = () => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Check if there are any active players
    const activePlayers = getActivePlayers()
    if (activePlayers.length === 0) {
      setPopupMessage("⚠️ No active players")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send start game message
    sendWebSocketMessage({
      action: "start_game"
    })

    // Update UI states
    setIsPlaying(true)
    setIsGameStarted(true)
    setIsRoundFinished(false)
    setShowNextButton(true)
    setPopupMessage("🎮 Game started!")
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const stopGameLoop = () => {
    if (gameState?.game_phase === "playing") {
      sendWebSocketMessage({
        action: "reset_round"
      })
    }
    setIsPlaying(false)
    setIsGameStarted(false)
    setIsDealerSelected(false)
    setShowNextButton(false)
    setIsRoundFinished(true)
    setPopupMessage("🛑 Game stopped")
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const sendWebSocketMessage = (message: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("Sending message to server:", message);
      socket.send(JSON.stringify(message));
    } else {
      setPopupMessage("⚠️ Not connected to server");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
    }
  };

  // Add this new function to get active players
  const getActivePlayers = () => {
    if (!gameState) return []
    return Object.entries(gameState.players)
      .filter(([_, data]) => data.status === 1)
      .map(([id]) => id)
  }

  const cardValues = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
  const suits = [
    { symbol: "♠", value: "S", color: "text-gray-800", name: "Spades" },
    { symbol: "♦", value: "D", color: "text-red-500", name: "Diamonds" },
    { symbol: "♣", value: "C", color: "text-gray-800", name: "Clubs" },
    { symbol: "♥", value: "H", color: "text-red-500", name: "Hearts" }
  ]

  // Update the dealer total check
  const dealerTotal = gameState?.dealer?.total ?? 0

  const handleNextTurn = () => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    sendWebSocketMessage({
      action: "next_turn"
    })
  }

  const handleRevealDealer = () => {
    sendWebSocketMessage({
      action: "reveal_dealer"
    })
  }

  const handleStandDealer = () => {
    sendWebSocketMessage({
      action: "stand_dealer"
    })
  }

  const resetGame = () => {
    if (!socket || !isConnected) {
      setPopupMessage("⚠️ Not connected to server");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
      return;
    }

    // Reset all local state
    setIsPlaying(false);
    setIsGameStarted(false);
    setIsRoundFinished(false);
    setShowNextButton(false);
    setIsDealerSelected(false);
    setSelectedCard(null);
    setSelectedSuit(null);

    // Send reset game message to server
    sendWebSocketMessage({
      action: "reset_game"
    });

    setPopupMessage("🔄 Game has been reset");
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000);
  };

  const handleHitDealer = () => {
    if (!selectedCard || !selectedSuit) {
      setPopupMessage("⚠️ Please select a card first")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    const cardCode = selectedCard + selectedSuit
    sendWebSocketMessage({
      action: "hit_dealer",
      card: cardCode
    })

    // Clear selections after sending
    setSelectedCard(null)
    setSelectedSuit(null)
    setIsDealerSelected(false)
  }

  const assignCard = () => {
    if (!gameState?.selected_hand?.player_id || !selectedCard || !selectedSuit) {
      setPopupMessage("⚠️ Please select player, card, and suit")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Ensure player is active
    if (!gameState?.players[gameState.selected_hand.player_id]?.status) {
      setPopupMessage("⚠️ Player must be active to add cards")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    const cardCode = selectedCard + selectedSuit
    sendWebSocketMessage({
      action: "hit_player",
      player_id: gameState.selected_hand.player_id,
      hand_index: gameState.selected_hand.hand_index,
      card: cardCode
    })

    // Clear selections after sending
    setSelectedCard(null)
    setSelectedSuit(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -right-4 w-72 h-72 bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-gradient-to-br from-red-600/10 to-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="bg-gradient-to-r from-red-800 to-red-700 rounded-2xl p-6 shadow-2xl border border-red-600 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">🎰</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  Dealer Control Panel
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <p className="text-gray-200">Table FT{gameState?.table_number || 1234}</p>
                  <div
                    className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                      isConnected
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                      }`}
                    ></div>
                    <span className="capitalize">{isConnected ? "connected" : "disconnected"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={isPlaying ? stopGameLoop : startGameLoop}
                disabled={!isConnected || (isPlaying && !isRoundFinished)}
                className={`h-12 w-full bg-gradient-to-r ${
                  isConnected && (!isPlaying || isRoundFinished)
                    ? "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    : "from-gray-500 to-gray-600 cursor-not-allowed"
                } text-white rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center justify-center space-x-3 font-semibold`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isPlaying ? "M6 6h12M6 12h12M6 18h12" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"}
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isPlaying ? "" : "M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}
                  />
                </svg>
                <span>{isPlaying ? "Stop" : "Play"}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isPlaying) {
                    stopGameLoop()
                  } else if (gameState?.dealer?.hidden_card) {
                    sendWebSocketMessage({ action: "reveal_dealer" })
                  }
                }}
                className={`h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-8 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center justify-center space-x-3 font-semibold ${
                  !isPlaying && !gameState?.dealer?.hidden_card ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={!isPlaying && !gameState?.dealer?.hidden_card}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isPlaying ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </>
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
                <span>{isPlaying ? "Stop Round" : "Reveal Card"}</span>
              </button>

              <button
                onClick={() => sendWebSocketMessage({ action: "reset_game" })}
                className="h-12 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center justify-center space-x-3 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>New Game</span>
              </button>
            </div>
          </div>
          </div>
        </div>

      {/* Main Content Area - Flex container for 70-30 split */}
      <div className="max-w-7xl mx-auto flex gap-6 relative z-10">
        {/* Left Section - 70% width for Dealer and Players */}
        <div className="w-[70%] space-y-6">
          {/* Dealer Window */}
          <div className="flex justify-center">
            <div 
              className={`w-[80%] rounded-2xl p-4 shadow-2xl transition-all duration-300 ${
                gameState?.current_turn === "dealer"
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400" 
                  : "bg-gradient-to-br from-blue-600/80 to-blue-500/80 backdrop-blur-xl border border-blue-400"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-bold flex items-center ${
                  gameState?.current_turn === "dealer" ? "text-gray-900" : "text-white"
                }`}>
                  <svg className={`w-5 h-5 mr-2 ${gameState?.current_turn === "dealer" ? "text-gray-900" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                  Dealer Status
                </h2>
                <div className="flex items-center space-x-3">
                  <div
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      gameState?.dealer?.status === "playing"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : gameState?.dealer?.status === "bust"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                    }`}
                  >
                    {gameState?.dealer?.status || "waiting"}
                  </div>
                  <div className={`text-sm ${gameState?.current_turn === "dealer" ? "text-gray-900" : "text-gray-400"}`}>
                    Cards: {gameState?.deck_count || 0}
                  </div>
                </div>
              </div>

              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-base font-medium text-white">Dealer's Cards</div>
                  <div className="text-xl font-bold">
                    Total:{" "}
                    <span
                      className={`
                      ${dealerTotal > 21
                        ? "text-red-500"
                        : "text-blue-400"
                      }`}
                    >
                      {dealerTotal}
                    </span>
                  </div>
                </div>
                <div className="flex justify-center space-x-3 mb-4">
                  {gameState?.dealer?.cards?.map((card: string, index: number) => (
                    <div key={index} className="w-14 h-20 transform hover:scale-110 transition-transform duration-200">
                      {index === 0 && !gameState?.dealer?.revealed ? (
                        <img src="/cards/BR.png" alt="Back of card" className="w-full h-full object-contain drop-shadow-xl" />
                      ) : (
                        <img src={`/cards/${card}.png`} alt={card} className="w-full h-full object-contain drop-shadow-xl" />
                      )}
                    </div>
                  ))}
                  {gameState?.dealer?.hidden_card && !gameState?.dealer?.revealed && (
                    <div className="w-14 h-20 transform hover:scale-110 transition-transform duration-200">
                      <img src="/cards/BR.png" alt="Hidden card" className="w-full h-full object-contain drop-shadow-xl" />
                    </div>
                  )}
                  {gameState?.dealer?.hidden_card && gameState?.dealer?.revealed && (
                    <div className="w-14 h-20 transform hover:scale-110 transition-transform duration-200">
                      <img src={`/cards/${gameState.dealer.hidden_card}.png`} alt={gameState.dealer.hidden_card} className="w-full h-full object-contain drop-shadow-xl" />
                    </div>
                  )}
                  {/* Empty card slots */}
                  {[
                    ...Array(
                      Math.max(0, 2 - (gameState?.dealer?.cards?.length || 0) - (gameState?.dealer?.hidden_card ? 1 : 0)),
                    ),
                  ].map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="w-14 h-20 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50 transform hover:scale-110 transition-transform duration-200"
                    >
                      <span className="text-gray-400 text-xs">Empty</span>
                    </div>
                  ))}
        </div>

                {/* Dealer Controls */}
                <div className="flex items-center justify-center space-x-3">
                  {gameState?.current_turn === "dealer" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStandDealer()
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Stand</span>
                </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNextTurn()
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span>Next</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Players Grid - 2 per row */}
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(gameState?.players || {}).map(([playerId, playerData]) => {
              const isCurrentHand = gameState?.selected_hand?.player_id === playerId && 
                                   gameState?.selected_hand?.hand_index === 0 && 
                                   gameState?.selected_hand?.split_level === 0;

              const isCurrentSplit1Hand = gameState?.selected_hand?.player_id === playerId && 
                                        gameState?.selected_hand?.hand_index === 0 && 
                                        gameState?.selected_hand?.split_level === 1;

              const isCurrentSplit2Hand = gameState?.selected_hand?.player_id === playerId && 
                                        gameState?.selected_hand?.hand_index === 0 && 
                                        gameState?.selected_hand?.split_level === 2;

              const isCurrentPlayer = gameState?.current_player === playerId && gameState?.current_turn === "player"
              const isActive = playerData.status === 1
              return (
                <div
                  key={playerId}
                  className={`p-5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
                    isCurrentHand
                      ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                      : isActive
                        ? "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30"
                        : "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isActive) {
                      handlePlayerClick(playerId)
                    }
                  }}
                >
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full shadow-lg ${
                            isCurrentHand
                              ? "bg-yellow-400 animate-pulse"
                              : isCurrentPlayer
                                ? "bg-green-400 animate-pulse"
                                : "bg-gray-400"
                          }`}
                        />
                        <div>
                          <div className={`text-lg font-bold ${isCurrentHand ? "text-gray-900" : isCurrentPlayer ? "text-gray-900" : "text-white"}`}>
                            {playerId.replace("player", "Player ")}
                          </div>
                          <div className={`text-sm ${isCurrentHand ? "text-gray-700" : isCurrentPlayer ? "text-gray-700" : "opacity-75"}`}>
                            {isCurrentHand ? "Current Hand" : isCurrentPlayer ? "Current Turn" : isActive ? "Active" : "Inactive"}
                          </div>
                        </div>
                      </div>
                      {!isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            activatePlayer(playerId)
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>Activate</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deactivatePlayer(playerId)
                          }}
                          className={`px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium ${
                            isCurrentHand
                              ? "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"
                              : isCurrentPlayer
                                ? "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800"
                                : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>Deactivate</span>
                        </button>
                      )}
                      </div>

                    {isActive && (
                      <div className="space-y-4">
                        {/* Cards Display */}
                        <div className={`rounded-lg p-3 ${isHandSelected(gameState, playerId, 0, 0) ? "bg-yellow-500/20" : "bg-black/20"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`text-sm font-medium ${isCurrentHand ? "text-gray-900" : "text-white"}`}>
                              Cards:
                        </div>
                          </div>
                          <div className="flex space-x-2 mb-2">
                            {gameState?.players?.[playerId]?.hands?.[0]?.cards?.map((card: string, index: number) => (
                              <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                <img
                                  src={`/cards/${card}.png`}
                                  alt={card}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/cards/back.png"
                                  }}
                                />
                              </div>
                            ))}
                            {/* Empty card slots */}
                            {[
                              ...Array(Math.max(0, 2 - (gameState?.players?.[playerId]?.hands?.[0]?.cards?.length ?? 0))),
                            ].map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                  isCurrentHand
                                    ? "border-yellow-400/50 bg-yellow-500/10"
                                    : "border-gray-400 bg-gray-800/50"
                                }`}
                              />
                            ))}
                              </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span
                              className={`text-lg font-bold ${
                                (gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0) > 21
                                  ? "text-red-500"
                                  : isCurrentHand
                                    ? "text-gray-900"
                                    : "text-blue-400"
                              }`}
                            >
                              {gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0}
                            </span>
                            <div className="flex space-x-2">
                              {gameState?.players?.[playerId]?.hands?.[0]?.status === "playing" && (
                                <>
                                  <button
                                    onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                  >
                                    Hit
                                  </button>
                                  <button
                                    onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                    className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                  >
                                    Double
                                  </button>
                                  <button
                                    onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  >
                                    Stand
                                  </button>
                                </>
                              )}
                              {gameState?.players?.[playerId]?.hands?.[0]?.cards.length === 2 &&
                                gameState?.players?.[playerId]?.hands?.[0]?.cards?.[0]?.[0] === gameState?.players?.[playerId]?.hands?.[0]?.cards?.[1]?.[0] && 
                                gameState?.players?.[playerId]?.hands?.[0]?.status === "playing" && (
                                  <button
                                    onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                    className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                  >
                                    Split
                                  </button>
                                )}
                            </div>
                          </div>
                        </div>

                        {/* Split1 Hands Display */}
                        {gameState?.players?.[playerId]?.split1?.[0]?.cards?.length > 0 && (
                          <div className="mt-4 border-t border-gray-300 pt-3">
                            <div className="text-sm font-medium text-gray-400 mb-2">Split 1:</div>
                            <div className={`rounded-lg p-3 ${isHandSelected(gameState, playerId, 0, 1) ? "bg-yellow-500/20" : "bg-black/20"}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className={`text-sm font-medium ${isCurrentSplit1Hand ? "text-gray-900" : "text-white"}`}>
                                  Cards:
                                </div>
                              </div>
                              <div className="flex space-x-2 mb-2">
                                {gameState.players[playerId].split1[0].cards.map((card, index) => (
                                  <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                    <img
                                      src={`/cards/${card}.png`}
                                      alt={card}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.src = "/cards/back.png"
                                      }}
                                    />
                                  </div>
                                ))}
                                {/* Empty card slots */}
                                {[...Array(Math.max(0, 2 - (gameState.players[playerId].split1[0].cards.length ?? 0)))].map((_, index) => (
                                  <div
                                    key={`empty-${index}`}
                                    className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                      isCurrentSplit1Hand
                                        ? "border-yellow-400/50 bg-yellow-500/10"
                                        : "border-gray-400 bg-gray-800/50"
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span
                                  className={`text-lg font-bold ${
                                    (gameState.players[playerId].split1[0].total ?? 0) > 21
                                      ? "text-red-500"
                                      : isCurrentSplit1Hand
                                        ? "text-gray-900"
                                        : "text-blue-400"
                                  }`}
                                >
                                  {gameState.players[playerId].split1[0].total ?? 0}
                                </span>
                                <div className="flex space-x-2">
                                  {gameState.players[playerId].split1[0].status === "playing" && (
                                    <>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                      >
                                        Hit
                                      </button>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                      >
                                        Double
                                      </button>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                      >
                                        Stand
                                      </button>
                                    </>
                                  )}
                                  {gameState.players[playerId].split1[0].cards.length === 2 &&
                                    gameState.players[playerId].split1[0].cards[0][0] === gameState.players[playerId].split1[0].cards[1][0] &&
                                    gameState.players[playerId].split1[0].status === "playing" && (
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                        className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                      >
                                        Split
                                      </button>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Split2 Hands Display */}
                        {gameState?.players?.[playerId]?.split2?.[0]?.cards?.length > 0 && (
                          <div className="mt-4 border-t border-gray-300 pt-3">
                            <div className="text-sm font-medium text-gray-400 mb-2">Split 2:</div>
                            <div className={`rounded-lg p-3 ${
                              gameState && gameState.selected_hand && 
                              gameState.selected_hand.player_id === playerId && 
                              gameState.selected_hand.hand_index === 0 && 
                              gameState.selected_hand.split_level === 2 ? 
                              "bg-yellow-500/20" : "bg-black/20"
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className={`text-sm font-medium ${isCurrentSplit2Hand ? "text-gray-900" : "text-white"}`}>
                                  Cards:
                                </div>
                              </div>
                              <div className="flex space-x-2 mb-2">
                                {gameState.players[playerId].split2[0].cards.map((card, index) => (
                                  <div key={index} className="relative w-12 h-16 transform hover:scale-110 transition-transform duration-200 group">
                                    <img
                                      src={`/cards/${card}.png`}
                                      alt={card}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.src = "/cards/back.png"
                                      }}
                                    />
                                  </div>
                                ))}
                                {/* Empty card slots */}
                                {[...Array(Math.max(0, 2 - (gameState.players[playerId].split2[0].cards.length ?? 0)))].map((_, index) => (
                                  <div
                                    key={`empty-${index}`}
                                    className={`w-12 h-16 border-2 border-dashed rounded-lg ${
                                      isCurrentSplit2Hand
                                        ? "border-yellow-400/50 bg-yellow-500/10"
                                        : "border-gray-400 bg-gray-800/50"
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span
                                  className={`text-lg font-bold ${
                                    (gameState.players[playerId].split2[0].total ?? 0) > 21
                                      ? "text-red-500"
                                      : isCurrentSplit2Hand
                                        ? "text-gray-900"
                                        : "text-blue-400"
                                  }`}
                                >
                                  {gameState.players[playerId].split2[0].total ?? 0}
                                </span>
                                <div className="flex space-x-2">
                                  {gameState.players[playerId].split2[0].status === "playing" && (
                                    <>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "hit_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                      >
                                        Hit
                                      </button>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "double_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                      >
                                        Double
                                      </button>
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "stand_player", player_id: playerId, hand_index: 0 })}
                                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                      >
                                        Stand
                                      </button>
                                    </>
                                  )}
                                  {gameState.players[playerId].split2[0].cards.length === 2 &&
                                    gameState.players[playerId].split2[0].cards[0][0] === gameState.players[playerId].split2[0].cards[1][0] &&
                                    gameState.players[playerId].split2[0].status === "playing" && (
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                        className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                      >
                                        Split
                                      </button>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Button - Show for current player */}
                  {isActive && isCurrentPlayer && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNextTurn()
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span>Next</span>
                              </button>
                            </div>
                  )}
                </div>
              )
            })}
                            </div>
                          </div>

        {/* Right Section - 30% width for Card Selection */}
        <div className="w-[30%]">
          <div className="bg-gradient-to-br from-red-800/80 to-red-700/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-red-600 sticky top-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Deal Card
            </h2>

            {/* Game Controls */}
            <div className="mb-8 flex justify-center items-center">
              <div className="grid grid-cols-2 gap-4">
                {/* Global Undo Button */}
                <button
                  onClick={() => sendWebSocketMessage({ action: "undo_last" })}
                  className="h-12 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <span>Undo Last Action</span>
                </button>

                <button
                  onClick={() => sendWebSocketMessage({ action: "reshuffle" })}
                  className="h-12 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reshuffle</span>
                </button>

                <button
                  onClick={() => sendWebSocketMessage({ action: "reset_round" })}
                  className="h-12 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset Round</span>
                </button>

                <button
                  onClick={() => sendWebSocketMessage({ action: "reset_game" })}
                  className="h-12 px-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset Game</span>
                </button>
              </div>
            </div>

            {/* Card Values */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Card Value:</h3>
              <div className="grid grid-cols-4 gap-2">
                {cardValues.map((value) => (
                                <button
                    key={value}
                    className={`p-2 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                      selectedCard === value
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                        : "bg-gradient-to-br from-gray-600 to-gray-700 text-white hover:from-gray-500 hover:to-gray-600 shadow-lg"
                    }`}
                    onClick={() => setSelectedCard(value)}
                  >
                    {value}
                                </button>
                              ))}
              </div>
                            </div>

                            {/* Suits */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Suit:</h3>
              <div className="grid grid-cols-2 gap-4">
                              {suits.map((suit) => (
                                <button
                                  key={suit.value}
                    className={`p-3 rounded-xl text-3xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 ${
                      selectedSuit === suit.value
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                        : `bg-gradient-to-br from-gray-600 to-gray-700 text-white hover:from-gray-500 hover:to-gray-600 shadow-lg`
                                    }`}
                                  onClick={() => setSelectedSuit(suit.value)}
                                >
                    <span className={suit.color}>{suit.symbol}</span>
                    <span className="text-sm font-medium">{suit.name}</span>
                                </button>
                              ))}
                            </div>
                            </div>

            {/* Preview and Assign Button */}
            {selectedCard && selectedSuit && (
              <div className="flex flex-col items-center gap-4 mt-6">
                <div className="relative">
                  <div className="w-24 h-36 transform hover:scale-110 transition-transform duration-300">
                    <img
                      src={`/cards/${selectedCard}${selectedSuit}.png`}
                      alt={`${selectedCard}${selectedSuit}`}
                      className="w-full h-full object-contain drop-shadow-2xl"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/cards/back.png"
                      }}
                    />
                          </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (gameState?.current_turn === "dealer") {
                      handleHitDealer()
                    } else if (gameState?.selected_hand?.player_id) {
                      assignCard()
                    } else {
                      setPopupMessage("⚠️ Please select a player or dealer first")
                      setShowPopup(true)
                      setTimeout(() => setShowPopup(false), 3000)
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center justify-center space-x-2 text-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                  <span>Deal Card</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DebugPanel at the end */}
      <DebugPanel gameState={gameState} />

      {/* Enhanced Popup Message */}
      {showPopup && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-red-800 to-red-700 border border-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-xl">
            <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium text-lg">{popupMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameMenu
