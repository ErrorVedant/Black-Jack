"use client"
import { useState, useEffect, useRef } from "react"

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
  manual_distribution_count: number
  next_manual_counter: number
}

// Add these helper functions at the top of the file, after the interfaces
const isHandSelected = (gameState: GameState | null, playerId: string, handIndex: number, splitLevel: number): boolean => {
  return gameState?.selected_hand?.player_id === playerId &&
    gameState?.selected_hand?.hand_index === handIndex &&
    gameState?.selected_hand?.split_level === splitLevel;
};

const canSplit = (cards: string[]): boolean => {
  if (cards.length !== 2) return false;
  // Only compare the rank (first character)
  return cards[0][0] === cards[1][0];
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
    <></>
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
  const [insuranceState, setInsuranceState] = useState<{ [key: string]: boolean }>({});
  const [dealerAutoPlayed, setDealerAutoPlayed] = useState(false);
  const [waitingForServer, setWaitingForServer] = useState(false);

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
          case "player_hit":
          case "dealer_hit":
            setWaitingForServer(false);
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

  useEffect(() => {
    if (
      gameState?.mode === "auto" &&
      gameState?.round_number === 0 &&
      gameState?.selected_hand?.player_id === "dealer" &&
      gameState?.manual_distribution_count === 1
    ) {
      console.log("next_turn is happening automatically")
      // sendWebSocketMessage({ action: "next_turn" });
    }
  }, [gameState, socket]);

  useEffect(() => {
    if (
      gameState?.mode === "auto" &&
      gameState?.round_number === 1 &&
      gameState?.selected_hand?.player_id === "dealer" &&
      !dealerAutoPlayed
    ) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: "dealer_auto_play" }));
        setDealerAutoPlayed(true);
      }
    }
    // Reset flag if round_number changes
    if (dealerAutoPlayed && gameState?.round_number !== 1) {
      setDealerAutoPlayed(false);
    }
  }, [gameState, socket, dealerAutoPlayed]);

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


  const assignCard = () => {
    if (waitingForServer) return; // Prevent double send

    if (gameState?.game_phase === "dealer" && selectedCard && selectedSuit) {
      // Allow dealing card to dealer
      const cardCode = selectedCard + selectedSuit;
      setWaitingForServer(true);
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
    // Ensure player is active
    if (!gameState?.players[gameState.selected_hand.player_id]?.status) {
      setPopupMessage("⚠️ Player must be active to add cards");
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
      return;
    }
    const cardCode = selectedCard + selectedSuit;
    setWaitingForServer(true);
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

  // Helper to get hand color class
  const getHandBoxColor = (selected: boolean, result?: string) => {
    if (selected) return "bg-yellow-300 border-2 border-yellow-500";
    if (result === "fail") return "bg-red-500 border-2 border-red-700 text-white";
    if (result === "win") return "bg-green-500 border-2 border-green-700 text-white";
    if (result === "tie") return "bg-purple-500 border-2 border-purple-700 text-white";
    return "bg-black/20";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -right-4 w-72 h-72 bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-gradient-to-br from-red-600/10 to-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header Section */}
      {/* <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="bg-gradient-to-r from-red-800 to-red-700 rounded-2xl p-6 shadow-2xl border border-red-600 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">🎰</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  Dealer Control Panel (AUTOMATIC)
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => sendWebSocketMessage({ action: "distribute_cards" })}
                className="h-12 px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Distribute Cards</span>
              </button>

              <button
                onClick={() => sendWebSocketMessage({ action: "reset_game" })}
                className="h-12 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center justify-center space-x-3 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>New Game</span>
              </button>
            </div>
          </div>
        </div>
      </div> */}

      {/* Main Content Area - Flex container for 70-30 split */}
      <div className='h-screen max-h-screen flex flex-col p-4'>
        <div className='flex-1 border-4 border-yellow-600 bg-[#911606] p-4 overflow-hidden'>
          <div className='h-full flex gap-4'>
            {/* Left Section - Game Area */}
            <div className='w-[70%] flex flex-col space-y-4 h-full'>
              {/* Dealer Area */}
              <div className='border-2 border-dashed border-yellow-600 rounded-lg p-4 bg-red-800/50 flex-shrink-0'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-bold text-yellow-300'>
                    Dealer's Cards
                  </h2>
                  <div className='flex items-center space-x-4'>
                    <span className='bg-red-700 px-3 py-1 rounded text-sm border border-red-500'>
                      Total: {dealerTotal}
                    </span>
                    <button
                      onClick={() =>
                        sendWebSocketMessage({ action: 'distribute_cards' })
                      }
                      className='bg-yellow-600 hover:bg-yellow-700 text-black px-4 py-2 rounded font-semibold text-sm'
                    >
                      Distribute Cards
                    </button>
                    <button
                      onClick={() =>
                        sendWebSocketMessage({ action: 'reset_game' })
                      }
                      className='bg-white hover:bg-gray-100 text-black px-4 py-2 rounded font-semibold text-sm border'
                    >
                      New Game
                    </button>
                  </div>
                </div>

                <div className='flex justify-center space-x-4 mb-4'>
                  {gameState?.dealer?.cards?.map(
                    (card: string, index: number) => (
                      <div key={index} className='w-16 h-24'>
                        <img
                          src={`/cards/${card}.png`}
                          alt={card}
                          className='w-full h-full object-contain'
                        />
                      </div>
                    )
                  )}
                  {/* Empty card slots */}
                  {[
                    ...Array(
                      Math.max(0, 2 - (gameState?.dealer?.cards?.length || 0))
                    )
                  ].map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className='w-16 h-24 border border-dashed border-gray-400 rounded flex items-center justify-center bg-red-900/50'
                    >
                      <span className='text-2xl text-gray-500'>+</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Players Grid - 2x3 layout */}
              <div className='flex-1 grid grid-cols-3 gap-4 overflow-hidden'>
                {Object.entries(gameState?.players || {})
                  .slice(0, 6)
                  .map(([playerId, playerData], index) => {
                    const isCurrentHand =
                      gameState?.selected_hand?.player_id === playerId
                    const isActive = playerData.status === 1

                    return (
                      <div
                        key={playerId}
                        className='border-2 border-dashed border-yellow-600 rounded-lg p-3 bg-red-800/50 flex flex-col'
                        onClick={e => {
                          e.stopPropagation()
                          if (isActive) {
                            handlePlayerClick(playerId)
                          }
                        }}
                      >
                        <div className='flex items-center justify-between mb-3'>
                          <h3 className='text-sm font-bold text-yellow-300'>
                            Player {index + 1}
                          </h3>
                          {!isActive ? (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                activatePlayer(playerId)
                              }}
                              className='bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold'
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                deactivatePlayer(playerId)
                              }}
                              className='bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold'
                            >
                              Deactivate
                            </button>
                          )}
                        </div>

                        <div className='text-xs text-gray-300 mb-2'>
                          Total:{' '}
                          {gameState?.players?.[playerId]?.hands?.[0]?.total ??
                            0}
                        </div>

                        {isActive && (
                          <>
                            {/* Cards Display */}
                            <div className='flex justify-center space-x-2 mb-3 flex-1'>
                              {gameState?.players?.[
                                playerId
                              ]?.hands?.[0]?.cards?.map(
                                (card: string, cardIndex: number) => (
                                  <div key={cardIndex} className='w-12 h-16'>
                                    <img
                                      src={`/cards/${card}.png`}
                                      alt={card}
                                      className='w-full h-full object-contain'
                                      onError={e => {
                                        const target =
                                          e.target as HTMLImageElement
                                        target.src = '/cards/back.png'
                                      }}
                                    />
                                  </div>
                                )
                              )}
                              {/* Empty card slots */}
                              {[
                                ...Array(
                                  Math.max(
                                    0,
                                    2 -
                                      (gameState?.players?.[playerId]
                                        ?.hands?.[0]?.cards?.length ?? 0)
                                  )
                                )
                              ].map((_, cardIndex) => (
                                <div
                                  key={`empty-${cardIndex}`}
                                  className='w-12 h-16 border border-dashed border-gray-400 rounded flex items-center justify-center bg-red-900/50'
                                >
                                  <span className='text-lg text-gray-500'>
                                    +
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Action Buttons */}
                            {isHandSelected(gameState, playerId, 0, 0) &&
                              gameState?.current_player === playerId && (
                                <div className='flex justify-center space-x-1 mt-auto'>
                                  {/* Insurance Button: Only show if dealer's first card is Ace and insurance not taken */}
                                  {gameState?.dealer?.cards?.[0]?.[0] === "A" && !insuranceState[`${playerId}_0_0`] && !gameState.players[playerId].hands[0].insurence && (
                                    <button
                                      onClick={() => handleInsurance(playerId, 0, 0)}
                                      className='bg-yellow-600 hover:bg-yellow-700 text-black px-2 py-1 rounded text-xs font-semibold'
                                    >
                                      Insurance
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'hit_player',
                                        player_id: playerId,
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand(playerId, 0, 0)
                                    }}
                                    className='bg-yellow-600 hover:bg-yellow-700 text-black px-2 py-1 rounded text-xs font-semibold'
                                  >
                                    Hit
                                  </button>
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'double_player',
                                        player_id: playerId,
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand(playerId, 0, 0)
                                    }}
                                    className='bg-yellow-600 hover:bg-yellow-700 text-black px-2 py-1 rounded text-xs font-semibold'
                                  >
                                    Double
                                  </button>
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'next_turn',
                                        player_id: playerId,
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand(playerId, 0, 0)
                                    }}
                                    className='bg-yellow-600 hover:bg-yellow-700 text-black px-2 py-1 rounded text-xs font-semibold'
                                  >
                                    Stand
                                  </button>
                                  {/* Main hand split button */}
                                  {gameState?.players?.[playerId]?.hands?.[0]?.cards?.length === 2 &&
                                    canSplit(gameState.players[playerId].hands[0].cards) &&
                                    gameState.players[playerId].hands[0].status === "playing" && (
                                      <button
                                        onClick={() => sendWebSocketMessage({ action: "split_player_auto", player_id: playerId })}
                                        className='bg-yellow-600 hover:bg-yellow-700 text-black px-2 py-1 rounded text-xs font-semibold'
                                      >
                                        Split
                                      </button>
                                    )}
                                </div>
                              )}

                            {/* Split hands display (simplified for space) */}
                            {Array.isArray(
                              gameState?.players?.[playerId]?.split1
                            ) &&
                              gameState?.players?.[playerId]?.split1[0]?.cards
                                ?.length > 0 && (
                                <div className='mt-2 text-xs text-yellow-300'>
                                  Split1:{' '}
                                  {gameState.players[playerId].split1[0].total}
                                </div>
                              )}

                            {Array.isArray(
                              gameState?.players?.[playerId]?.split2
                            ) &&
                              gameState?.players?.[playerId]?.split2[0]?.cards
                                ?.length > 0 && (
                                <div className='mt-1 text-xs text-yellow-300'>
                                  Split2:{' '}
                                  {gameState.players[playerId].split2[0].total}
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Right Section - Controls */}
            <div className='w-[30%] flex flex-col h-full p-3 justify-between'>
              {/* Mode Selection */}
              <div className='flex space-x-1 justify-center flex-shrink-0'>
                <button className='px-3 py-2 bg-white text-black rounded text-sm font-semibold'>
                  Live
                </button>
                <button className='px-3 py-2 bg-red-600 text-white rounded text-sm font-semibold'>
                  Automatic
                </button>
                <button className='px-3 py-2 bg-white text-black rounded text-sm font-semibold'>
                  Manual
                </button>
              </div>

              {/* Game Actions */}
              <div className='space-y-2 flex-shrink-0'>
                <button
                  onClick={() => sendWebSocketMessage({ action: 'undo_last' })}
                  className='w-full bg-white hover:bg-gray-100 text-black py-2 px-4 rounded font-semibold text-sm'
                >
                  Undo Last Action
                </button>
                <button
                  onClick={() => sendWebSocketMessage({ action: 'reshuffle' })}
                  className='w-full bg-white hover:bg-gray-100 text-black py-2 px-4 rounded font-semibold text-sm'
                >
                  Reshuffle
                </button>
                <button
                  onClick={() =>
                    sendWebSocketMessage({ action: 'reset_round' })
                  }
                  className='w-full bg-white hover:bg-gray-100 text-black py-2 px-4 rounded font-semibold text-sm'
                >
                  Reset Round
                </button>
              </div>

              {/* Card Values Grid */}
              <div className='grid grid-cols-3 gap-2 flex-shrink-0'>
                {/* First row - Ace in center */}
                <div></div>
                <button
                  className={`p-2.5 rounded font-bold text-base ${
                    selectedCard === 'A'
                      ? 'bg-red-800 text-white'
                      : 'bg-white hover:bg-gray-100 text-black'
                  }`}
                  onClick={() => setSelectedCard('A')}
                >
                  A
                </button>
                <div></div>

                {/* Remaining cards (2-K) in subsequent rows */}
                {cardValues.slice(1).map(value => (
                  <button
                    key={value}
                    className={`p-2.5 rounded font-bold text-base ${
                      selectedCard === value
                        ? 'bg-red-800 text-white'
                        : 'bg-white hover:bg-gray-100 text-black'
                    }`}
                    onClick={() => setSelectedCard(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>

              {/* Suits */}
              <div className='grid grid-cols-2 gap-2 flex-shrink-0'>
                {suits.map(suit => (
                  <button
                    key={suit.value}
                    className={`p-3 rounded text-2xl ${
                      selectedSuit === suit.value
                        ? 'bg-red-800 text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedSuit(suit.value)}
                  >
                    <span className={suit.color}>{suit.symbol}</span>
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className='flex space-x-2 flex-shrink-0'>
                <button
                  onClick={assignCard}
                  className='flex-1 bg-yellow-600 hover:bg-yellow-700 text-black py-2.5 px-4 rounded font-bold text-sm'
                  disabled={
                    !(
                      selectedCard &&
                      selectedSuit &&
                      (gameState?.game_phase === 'dealer' ||
                        gameState?.selected_hand?.player_id)
                    )
                  }
                >
                  SEND CARD
                </button>
                <button
                  onClick={() => {
                    if (gameState?.current_turn === 'dealer') {
                      sendWebSocketMessage({ action: 'hit_player' })
                    } else if (gameState?.selected_hand?.player_id) {
                      sendWebSocketMessage({
                        action: 'hit_player',
                        player_id: gameState.selected_hand.player_id,
                        hand_index: gameState.selected_hand.hand_index
                      })
                    } else {
                      setPopupMessage(
                        '⚠️ Please select a player or dealer first'
                      )
                      setShowPopup(true)
                      setTimeout(() => setShowPopup(false), 3000)
                    }
                  }}
                  className='flex-1 bg-white hover:bg-gray-100 text-black py-2.5 px-4 rounded font-semibold text-sm'
                >
                  UNDO CARD
                </button>
              </div>
            </div>
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
