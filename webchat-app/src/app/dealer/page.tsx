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
  const [showPopup, setShowPopup] = useState(false)
  const [popupMessage, setPopupMessage] = useState("")
  const [isDealerSelected, setIsDealerSelected] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null)
  const [insuranceState, setInsuranceState] = useState<{ [key: string]: boolean }>({});
  const [dealerAutoPlayed, setDealerAutoPlayed] = useState(false);
  const [waitingForServer, setWaitingForServer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-black text-white p-8 relative overflow-hidden">
      {/* Enhanced Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Floating cards background */}
        <div className="absolute top-10 left-10 w-32 h-48 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-lg transform rotate-12 animate-float"></div>
        <div className="absolute top-32 right-20 w-24 h-36 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg transform -rotate-6 animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-28 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg transform rotate-45 animate-float-slow"></div>
        
        {/* Glowing orbs */}
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-gradient-to-br from-red-500/5 to-pink-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* Particle effects */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => {
            // Use integer-based calculations to ensure exact consistency
            const left = Math.round((i * 7.3) % 100);
            const top = Math.round((i * 11.7) % 100);
            const delay = Math.round((i * 0.3) % 3 * 10) / 10;
            const duration = Math.round((2 + (i * 0.2) % 2) * 10) / 10;
            
            return (
              <div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400/30 rounded-full animate-sparkle"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Enhanced Header Section */}
      <div className="max-w-7xl mx-auto mb-12 relative z-10">
        <div className="bg-gradient-to-r from-red-800/90 via-red-700/90 to-red-800/90 rounded-3xl p-8 shadow-2xl border border-red-500/50 backdrop-blur-xl relative overflow-hidden">
          {/* Header background effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-orange-500/5"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-8">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <span className="text-3xl font-bold text-white drop-shadow-lg">🎰</span>
                </div>
                <div className="absolute -inset-2 bg-gradient-to-br from-yellow-400/20 to-red-500/20 rounded-2xl blur-xl animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 bg-clip-text text-transparent drop-shadow-lg mb-2">
                  DEALER CONTROL PANEL
                </h1>
                <p className="text-2xl font-semibold text-red-200 mb-4">Select Your Gaming Mode</p>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-black/30 rounded-full border border-yellow-500/30">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-yellow-300 font-medium">Table FT{gameState?.table_number || 1234}</span>
                  </div>
                  <div
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium border ${
                      isConnected
                        ? "bg-green-500/20 text-green-300 border-green-400/50"
                        : "bg-red-500/20 text-red-300 border-red-400/50"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400 animate-pulse"}`}
                    ></div>
                    <span className="capitalize font-semibold">{isConnected ? "Connected" : "Disconnected"}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="hidden lg:flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full border border-yellow-400/30 animate-spin-slow"></div>
              <div className="w-8 h-8 bg-gradient-to-br from-red-400/20 to-pink-400/20 rounded-full border border-red-400/30 animate-pulse"></div>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full border border-purple-400/30 animate-bounce"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Main Content Area - Navigation Boxes */}
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Manual Dealer Navigation Box */}
          <div 
            onClick={() => window.location.href = '/dealer/manual'}
            className="group relative bg-gradient-to-br from-red-700/90 via-red-600/90 to-red-800/90 rounded-3xl p-10 shadow-2xl border border-red-400/50 backdrop-blur-xl cursor-pointer transition-all duration-500 transform hover:scale-105 hover:shadow-3xl hover:border-yellow-400/50 overflow-hidden"
          >
            {/* Box background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            
            <div className="text-center relative z-10">
              <div className="relative mx-auto mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                  <span className="text-4xl font-bold text-white drop-shadow-lg">🎮</span>
                </div>
                <div className="absolute -inset-3 bg-gradient-to-br from-yellow-400/20 to-red-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <h2 className="text-4xl font-black text-white mb-6 drop-shadow-lg">MANUAL MODE</h2>
              <p className="text-red-100 text-lg mb-8 leading-relaxed">
                Full manual control over winning and losing of players. Perfect for precise game management and dealer training.
              </p>
              
              <div className="flex items-center justify-center space-x-3 text-yellow-300 group-hover:text-yellow-200 transition-colors duration-300">
                <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="font-bold text-lg">ENTER MANUAL MODE</span>
              </div>
            </div>
          </div>

          {/* Auto Dealer Navigation Box */}
          <div 
            onClick={() => window.location.href = '/dealer/auto'}
            className="group relative bg-gradient-to-br from-red-700/90 via-red-600/90 to-red-800/90 rounded-3xl p-10 shadow-2xl border border-red-400/50 backdrop-blur-xl cursor-pointer transition-all duration-500 transform hover:scale-105 hover:shadow-3xl hover:border-yellow-400/50 overflow-hidden"
          >
            {/* Box background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            
            <div className="text-center relative z-10">
              <div className="relative mx-auto mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                  <span className="text-4xl font-bold text-white drop-shadow-lg">🤖</span>
                </div>
                <div className="absolute -inset-3 bg-gradient-to-br from-yellow-400/20 to-red-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              <h2 className="text-4xl font-black text-white mb-6 drop-shadow-lg">AUTO MODE</h2>
              <p className="text-red-100 text-lg mb-8 leading-relaxed">
                Automated card distribution with dealer AI. The dealer automatically plays according to standard blackjack rules.
              </p>
              
              <div className="flex items-center justify-center space-x-3 text-yellow-300 group-hover:text-yellow-200 transition-colors duration-300">
                <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="font-bold text-lg">ENTER AUTO MODE</span>
              </div>
            </div>
          </div>

          {/* Live Dealer Navigation Box */}
          <div 
            onClick={() => window.location.href = '/dealer/live'}
            className="group relative bg-gradient-to-br from-red-700/90 via-red-600/90 to-red-800/90 rounded-3xl p-10 shadow-2xl border border-red-400/50 backdrop-blur-xl cursor-pointer transition-all duration-500 transform hover:scale-105 hover:shadow-3xl hover:border-yellow-400/50 overflow-hidden"
          >
            {/* Box background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            
            <div className="text-center relative z-10">
              <div className="relative mx-auto mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                  <span className="text-4xl font-bold text-white drop-shadow-lg">🎯</span>
                </div>
                <div className="absolute -inset-3 bg-gradient-to-br from-yellow-400/20 to-red-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

              <h2 className="text-4xl font-black text-white mb-6 drop-shadow-lg">LIVE MODE</h2>
              <p className="text-red-100 text-lg mb-8 leading-relaxed">
                Real-time live dealer experience with manual card selection and automatic turn progression for authentic gameplay.
              </p>
              
              <div className="flex items-center justify-center space-x-3 text-yellow-300 group-hover:text-yellow-200 transition-colors duration-300">
                <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="font-bold text-lg">ENTER LIVE MODE</span>
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
          <div className="bg-gradient-to-r from-red-800/95 via-red-700/95 to-red-800/95 border-2 border-yellow-400/50 text-white px-10 py-6 rounded-3xl shadow-2xl flex items-center space-x-4 backdrop-blur-xl relative overflow-hidden">
            {/* Popup background effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-orange-500/10"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"></div>
            
            <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse shadow-lg"></div>
            <span className="font-bold text-xl drop-shadow-lg">{popupMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameMenu
