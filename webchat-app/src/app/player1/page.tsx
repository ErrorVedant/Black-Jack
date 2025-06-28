"use client";
import { useState, useEffect, useRef } from "react";
import PlayerBoard from "@/components/PlayerBoard";

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
}

const isHandSelected = (gameState: GameState | null, playerId: string, handIndex: number, splitLevel: number): boolean => {
  return gameState?.selected_hand?.player_id === playerId &&
    gameState?.selected_hand?.hand_index === handIndex &&
    gameState?.selected_hand?.split_level === splitLevel;
};

const canSplit = (cards: string[]): boolean => {
  if (cards.length !== 2) return false;
  return cards[0][0] === cards[1][0];
};

const DebugPanel = ({ gameState }: { gameState: GameState | null }) => {
  if (!gameState) return null;
  return <></>;
};

const GameMenu = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [isDealerSelected, setIsDealerSelected] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null);
  const [insuranceState, setInsuranceState] = useState<{ [key: string]: boolean }>({});

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

        if (data.game_state) {
          setGameState(data.game_state);
        }

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

    sendWebSocketMessage({
      action: "select_player",
      player_id: playerId
    })

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

    const activePlayers = getActivePlayers()
    if (activePlayers.length === 0) {
      setPopupMessage("⚠️ No active players")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    sendWebSocketMessage({
      action: "start_game"
    })

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

    setIsPlaying(false);
    setIsGameStarted(false);
    setIsRoundFinished(false);
    setShowNextButton(false);
    setIsDealerSelected(false);
    setSelectedCard(null);
    setSelectedSuit(null);

    sendWebSocketMessage({
      action: "reset_game"
    });

    setPopupMessage("🔄 Game has been reset");
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 3000);
  };

  const assignCard = () => {
    if (gameState?.game_phase === "dealer" && selectedCard && selectedSuit) {
      const cardCode = selectedCard + selectedSuit;
      sendWebSocketMessage({
        action: "hit_dealer",
        card: cardCode
      });
      setSelectedCard(null);
      setSelectedSuit(null);
      setIsDealerSelected(false);
      return;
    }
    if (!gameState?.selected_hand?.player_id || !selectedCard || !selectedSuit) {
      setPopupMessage("⚠️ Please select player, card, and suit");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
      return;
    }
    if (!gameState?.players[gameState.selected_hand.player_id]?.status) {
      setPopupMessage("⚠️ Player must be active to add cards");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
      return;
    }
    const cardCode = selectedCard + selectedSuit;
    sendWebSocketMessage({
      action: "hit_player",
      player_id: gameState.selected_hand.player_id,
      hand_index: gameState.selected_hand.hand_index,
      card: cardCode
    });
    setSelectedCard(null);
    setSelectedSuit(null);
  };

  const handleInsurance = (playerId: string, handIndex: number, splitLevel: number = 0) => {
    sendWebSocketMessage({
      action: "handle_insurance",
      player_id: playerId,
      hand_index: handIndex,
      split_level: splitLevel
    });
    setInsuranceState((prev) => ({ ...prev, [`${playerId}_${handIndex}_${splitLevel}`]: true }));
  };

  const clearInsuranceForHand = (playerId: string, handIndex: number, splitLevel: number = 0) => {
    setInsuranceState((prev) => {
      const newState = { ...prev };
      delete newState[`${playerId}_${handIndex}_${splitLevel}`];
      return newState;
    });
  };

  const player1Active = gameState?.players?.player1?.status === 1;

  // Helper to get hand color class (match dealer/auto/page.tsx)
  const getHandBoxColor = (selected: boolean, isActive: boolean, result?: string) => {
    if (selected) return "bg-yellow-300 border-2 border-yellow-500";
    if (result === "fail") return "bg-red-500 border-2 border-red-700 text-white";
    if (result === "win") return "bg-green-500 border-2 border-green-700 text-white";
    if (result === "tie") return "bg-purple-500 border-2 border-purple-700 text-white";
    if (isActive) return "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30";
    return "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30";
  };

  return (
    <div className="min-h-screen w-screen">
      {player1Active ? (
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
                      Player1 Panel
                    </h1>
                    <div className="flex items-center space-x-4 mt-2">
                      <p className="text-gray-200">Table FT{gameState?.table_number || 1234}</p>
                      <div
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                            }`}
                        ></div>
                        <span className="capitalize">{isConnected ? "connected" : "disconnected"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="max-w-7xl mx-auto flex flex-col gap-6 relative z-10">
            {/* Dealer Window */}
            <div className="flex justify-center">
              <div 
                className={`w-full rounded-2xl p-4 shadow-2xl transition-all duration-300 ${gameState?.game_phase === "dealer"
                    ? "bg-yellow-300 border-2 border-yellow-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                    : "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white backdrop-blur-xl border border-blue-400"
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold flex items-center ${gameState?.game_phase === "dealer" ? "text-gray-900" : "text-white"
                    }`}>
                    <svg className={`w-5 h-5 mr-2 ${gameState?.game_phase === "dealer" ? "text-gray-900" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${gameState?.dealer?.status === "playing"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : gameState?.dealer?.status === "bust"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        }`}
                    >
                      {gameState?.dealer?.status || "waiting"}
                    </div>
                    <div className={`text-sm ${gameState?.game_phase === "dealer" ? "text-gray-900" : "text-gray-400"}`}>
                      Cards: {gameState?.deck_count || 0}
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-base font-medium text-white">Dealer's Cards</div>
                    <div className="text-xl font-bold">
                      Total: {" "}
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
                          <img src={`/cards/${card}.png`} alt={card} className="w-full h-full object-contain drop-shadow-xl" />
                      </div>
                    ))}
                    {[...Array(Math.max(0, 2 - (gameState?.dealer?.cards?.length || 0)))].map((_, index) => (
                      <div
                        key={`empty-${index}`}
                        className="w-14 h-20 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50 transform hover:scale-110 transition-transform duration-200"
                      >
                        <span className="text-gray-400 text-xs">Empty</span>
                      </div>
                    ))}
                  </div>

                  {gameState?.game_phase === "dealer" && (
                    <div className="flex items-center justify-center space-x-3 mt-4">
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Player 1 - Large Panel */}
            {gameState?.players?.player1 && (
              <div className="w-full">
                <div
                  className={`p-6 rounded-xl transition-all duration-300 ${gameState.players.player1.status === 1
                    ? "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30"
                    : "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30"}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (gameState.players.player1.status === 1) {
                      handlePlayerClick("player1")
                    }
                  }}
                >
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-5 h-5 rounded-full shadow-lg ${isHandSelected(gameState, "player1", 0, 0)
                              ? "bg-blue-400 animate-pulse"
                              : gameState.players.player1.status === 1 
                                ? "bg-green-400 animate-pulse" 
                                : "bg-gray-400"
                            }`}
                        />
                        <div>
                          <div className={`text-2xl font-bold ${isHandSelected(gameState, "player1", 0, 0) ? "text-gray-900" : "text-white"}`}>
                            Player 1
                          </div>
                          <div className={`text-base ${isHandSelected(gameState, "player1", 0, 0) ? "text-gray-700" : "opacity-75"}`}>
                            {isHandSelected(gameState, "player1", 0, 0) ? "Current Hand" : gameState.players.player1.status === 1 ? "Active" : "Inactive"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {gameState.players.player1.status === 1 && (
                      <div className="space-y-6">
                        {/* Main Hand */}
                        <div className={`rounded-xl p-4 ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 0) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.hands[0]?.result)}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className={`text-lg font-medium ${isHandSelected(gameState, "player1", 0, 0) ? "text-gray-900" : "text-white"}`}>
                              Main Hand
                            </div>
                          </div>
                          <div className="flex space-x-3 mb-3">
                            {gameState.players.player1.hands[0]?.cards?.map((card: string, index: number) => (
                              <div key={index} className="relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group">
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
                            {[...Array(Math.max(0, 2 - (gameState.players.player1.hands[0]?.cards?.length ?? 0)))].map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                className={`w-16 h-24 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 0) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.hands[0]?.result)}`}
                              />
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className={"text-xl font-bold text-blue-400"}>
                              {gameState.players.player1.hands[0]?.total ?? 0}
                            </span>
                            <div className="flex space-x-3">
                              {isHandSelected(gameState, "player1", 0, 0) && gameState?.current_player === "player1" &&
                                gameState.players.player1.hands[0]?.cards?.length === 2 &&
                                canSplit(gameState.players.player1.hands[0].cards) &&
                                gameState.players.player1.hands[0].status === "playing" && (
                                <button
                                  onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: "player1" })}
                                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                >
                                  Split
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Main Hand Action Buttons for Player 1 */}
                          {isHandSelected(gameState, "player1", 0, 0) && gameState?.current_player === "player1" && (
                            <div className="flex gap-2 flex-wrap mt-2">
                              {gameState?.dealer?.cards?.[0]?.[0] === "A" && !insuranceState[`player1_0_0`] && !gameState.players.player1.hands[0].insurence && (
                                <button
                                  onClick={() => handleInsurance("player1", 0, 0)}
                                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                >
                                  Insurance
                                </button>
                              )}
                              <button
                                onClick={() => { sendWebSocketMessage({ action: "hit_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 0); }}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                              >
                                Hit
                              </button>
                              <button
                                onClick={() => { sendWebSocketMessage({ action: "double_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 0); }}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                              >
                                Double
                              </button>
                              <button
                                onClick={() => { sendWebSocketMessage({ action: "next_turn", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 0); }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                              >
                                Stand
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Split1 Hand */}
                        {gameState.players.player1.split1[0]?.cards?.length > 0 && (
                          <div className="mt-4">
                            <div className={`rounded-xl p-4 ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 1) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.split1[0]?.result)}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className={`text-lg font-medium ${isHandSelected(gameState, "player1", 0, 1) ? "text-gray-900" : "text-white"}`}>
                                  Split Hand 1
                                </div>
                              </div>
                              <div className="flex space-x-3 mb-3">
                                {gameState.players.player1.split1[0].cards.map((card, index) => (
                                  <div key={index} className="relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group">
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
                                {[...Array(Math.max(0, 2 - (gameState.players.player1.split1[0].cards.length ?? 0)))].map((_, index) => (
                                  <div
                                    key={`empty-${index}`}
                                    className={`w-16 h-24 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 1) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.split1[0]?.result)}`}
                                  />
                                ))}
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className={"text-xl font-bold text-blue-400"}>
                                  {gameState.players.player1.split1[0].total ?? 0}
                                </span>
                                <div className="flex space-x-3">
                                  {isHandSelected(gameState, "player1", 0, 1) && gameState?.current_player === "player1" &&
                                    gameState.players.player1.split1[0]?.cards?.length === 2 &&
                                    canSplit(gameState.players.player1.split1[0].cards) &&
                                    gameState.players.player1.split1[0].status === "playing" && (
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: "player1" })}
                                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                    >
                                      Split
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Split1 Hand Action Buttons for Player 1 */}
                              {isHandSelected(gameState, "player1", 0, 1) && gameState?.current_player === "player1" && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  {gameState?.dealer?.cards?.[0]?.[0] === "A" && !insuranceState[`player1_0_1`] && !gameState.players.player1.split1[0].insurence && (
                                    <button
                                      onClick={() => handleInsurance("player1", 0, 1)}
                                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                    >
                                      Insurance
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "hit_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 1); }}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                  >
                                    Hit
                                  </button>
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "double_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 1); }}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                                  >
                                    Double
                                  </button>
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "next_turn", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 1); }}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                  >
                                    Stand
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Split2 Hand */}
                        {gameState.players.player1.split2[0]?.cards?.length > 0 && (
                          <div className="mt-4">
                            <div className={`rounded-xl p-4 ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 2) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.split2[0]?.result)}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className={`text-lg font-medium ${isHandSelected(gameState, "player1", 0, 2) ? "text-gray-900" : "text-white"}`}>
                                  Split Hand 2
                                </div>
                              </div>
                              <div className="flex space-x-3 mb-3">
                                {gameState.players.player1.split2[0].cards.map((card, index) => (
                                  <div key={index} className="relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group">
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
                                {[...Array(Math.max(0, 2 - (gameState.players.player1.split2[0].cards.length ?? 0)))].map((_, index) => (
                                  <div
                                    key={`empty-${index}`}
                                    className={`w-16 h-24 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, "player1", 0, 2) && gameState?.current_player === "player1", gameState.players.player1.status === 1, gameState.players.player1.split2[0]?.result)}`}
                                  />
                                ))}
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className={"text-xl font-bold text-blue-400"}>
                                  {gameState.players.player1.split2[0].total ?? 0}
                                </span>
                                <div className="flex space-x-3">
                                  {isHandSelected(gameState, "player1", 0, 2) && gameState?.current_player === "player1" &&
                                    gameState.players.player1.split2[0]?.cards?.length === 2 &&
                                    canSplit(gameState.players.player1.split2[0].cards) &&
                                    gameState.players.player1.split2[0].status === "playing" && (
                                    <button
                                      onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: "player1" })}
                                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                    >
                                      Split
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Split2 Hand Action Buttons for Player 1 */}
                              {isHandSelected(gameState, "player1", 0, 2) && gameState?.current_player === "player1" && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  {gameState?.dealer?.cards?.[0]?.[0] === "A" && !insuranceState[`player1_0_2`] && !gameState.players.player1.split2[0].insurence && (
                                    <button
                                      onClick={() => handleInsurance("player1", 0, 2)}
                                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                    >
                                      Insurance
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "hit_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 2); }}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                  >
                                    Hit
                                  </button>
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "double_player", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 2); }}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                                  >
                                    Double
                                  </button>
                                  <button
                                    onClick={() => { sendWebSocketMessage({ action: "next_turn", player_id: "player1", hand_index: 0 }); clearInsuranceForHand("player1", 0, 2); }}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                  >
                                    Stand
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Button */}
                  {gameState.players.player1.status === 1 && gameState?.current_turn === "player" && (
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNextTurn()
                        }}
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-base"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span>Next Turn</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other Players - Grid Layout */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {Object.entries(gameState?.players || {})
                .filter(([playerId]) => playerId !== "player1")
                .map(([playerId, playerData]) => {
                  const isCurrentHand = gameState?.selected_hand?.player_id === playerId &&
                    gameState?.selected_hand?.hand_index === 0 &&
                    gameState?.selected_hand?.split_level === 0;

                  const isCurrentSplit1Hand = gameState?.selected_hand?.player_id === playerId &&
                    gameState?.selected_hand?.hand_index === 0 &&
                    gameState?.selected_hand?.split_level === 1;

                  const isCurrentSplit2Hand = gameState?.selected_hand?.player_id === playerId &&
                    gameState?.selected_hand?.hand_index === 0 &&
                    gameState?.selected_hand?.split_level === 2;

                  const isActive = playerData.status === 1;
                  return (
                    <div
                      key={playerId}
                      className={`p-4 rounded-xl transition-all duration-300 ${isActive
                        ? "bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30"
                        : "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30"}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isActive) {
                          handlePlayerClick(playerId)
                        }
                      }}
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-3 h-3 rounded-full shadow-lg ${isCurrentHand
                                  ? "bg-blue-400 animate-pulse"
                                  : isActive 
                                    ? "bg-green-400 animate-pulse" 
                                    : "bg-gray-400"
                                }`}
                            />
                            <div>
                              <div className={`text-base font-bold ${isCurrentHand ? "text-gray-900" : "text-white"}`}>
                                {playerId.replace("player", "Player ")}
                              </div>
                              <div className={`text-xs ${isCurrentHand ? "text-gray-700" : "opacity-75"}`}>
                                {isCurrentHand ? "Current Hand" : isActive ? "Active" : "Inactive"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {isActive && (
                                                    <div className="space-y-3">
                            {/* Main Hand */}
                            <div className={`rounded-lg p-2 ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 0) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.hands?.[0]?.result)}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className={`text-xs font-medium ${isCurrentHand ? "text-gray-900" : "text-white"}`}>
                                  Cards:
                                </div>
                              </div>
                              <div className="flex space-x-1 mb-1">
                                {gameState?.players?.[playerId]?.hands?.[0]?.cards?.map((card: string, index: number) => (
                                  <div key={index} className="relative w-10 h-14 transform hover:scale-110 transition-transform duration-200 group">
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
                                {[...Array(Math.max(0, 2 - (gameState?.players?.[playerId]?.hands?.[0]?.cards?.length ?? 0)))].map((_, index) => (
                                  <div
                                    key={`empty-${index}`}
                                    className={`w-10 h-14 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 0) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.hands?.[0]?.result)}`}
                                  />
                                ))}
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span className={"text-sm font-bold text-blue-400"}>
                                  {gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0}
                                </span>
                              </div>
                            </div>

                            {/* Split1 Hand */}
                            {gameState?.players?.[playerId]?.split1?.[0]?.cards?.length > 0 && (
                              <div className="mt-2">
                                <div className={`rounded-lg p-2 ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 1) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.split1?.[0]?.result)}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className={`text-xs font-medium ${isCurrentSplit1Hand ? "text-gray-900" : "text-white"}`}>
                                      Split 1:
                                    </div>
                                  </div>
                                  <div className="flex space-x-1 mb-1">
                                    {gameState.players[playerId].split1[0].cards.map((card, index) => (
                                      <div key={index} className="relative w-10 h-14 transform hover:scale-110 transition-transform duration-200 group">
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
                                    {[...Array(Math.max(0, 2 - (gameState.players[playerId].split1[0].cards.length ?? 0)))].map((_, index) => (
                                      <div
                                        key={`empty-${index}`}
                                        className={`w-10 h-14 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 1) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.split1?.[0]?.result)}`}
                                      />
                                    ))}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <span className={"text-sm font-bold text-blue-400"}>
                                      {gameState.players[playerId].split1[0].total ?? 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Split2 Hand */}
                            {gameState?.players?.[playerId]?.split2?.[0]?.cards?.length > 0 && (
                              <div className="mt-2">
                                <div className={`rounded-lg p-2 ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 2) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.split2?.[0]?.result)}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className={`text-xs font-medium ${isCurrentSplit2Hand ? "text-gray-900" : "text-white"}`}>
                                      Split 2:
                                    </div>
                                  </div>
                                  <div className="flex space-x-1 mb-1">
                                    {gameState.players[playerId].split2[0].cards.map((card, index) => (
                                      <div key={index} className="relative w-10 h-14 transform hover:scale-110 transition-transform duration-200 group">
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
                                    {[...Array(Math.max(0, 2 - (gameState.players[playerId].split2[0].cards.length ?? 0)))].map((_, index) => (
                                      <div
                                        key={`empty-${index}`}
                                        className={`w-10 h-14 border-2 border-dashed rounded-lg ${getHandBoxColor(isHandSelected(gameState, playerId, 0, 2) && gameState?.current_player === playerId, isActive, gameState?.players?.[playerId]?.split2?.[0]?.result)}`}
                                      />
                                    ))}
                                  </div>
                                  <div className="mt-1 flex items-center justify-between">
                                    <span className={"text-sm font-bold text-blue-400"}>
                                      {gameState.players[playerId].split2[0].total ?? 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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
      ) : (
        <div className="fixed inset-0 w-screen h-screen flex justify-center items-center z-50">
          <video autoPlay loop muted className="absolute inset-0 w-full h-full object-cover">
            <source src="/assets/ocean7vid.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  );
};

export default GameMenu;