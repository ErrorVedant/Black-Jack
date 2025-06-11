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
  current_hand: number
  splits_used: number
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
}

const GameMenu = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [popupMessage, setPopupMessage] = useState("")
  const [gameState, setGameState] = useState<GameState | null>(null)

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:6790")
    setSocket(ws)

    ws.onopen = () => {
      console.log("Connected to WebSocket server")
      setIsConnected(true)
      setPopupMessage("🎉 Connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
    }

    ws.onclose = () => {
      console.log("Disconnected from WebSocket server")
      setIsConnected(false)
      setPopupMessage("⚠️ Disconnected from server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log("Received WebSocket message:", data)

      if (data.action === "update_game_state" || data.action === "player_hit" || data.action === "player_activated" || data.action === "player_removed") {
        console.log("Updating game state from server:", data.game_state)
        setGameState(data.game_state)
        
        // Show appropriate message
        if (data.action === "player_hit") {
          console.log("Card added to player:", data.player_id, "Card:", data.card)
          setPopupMessage(`🃏 Card ${data.card} added to ${data.player_id.replace("player", "Player ")}`)
          setShowPopup(true)
          setTimeout(() => setShowPopup(false), 3000)
        } else if (data.action === "player_activated") {
          setPopupMessage(`✅ ${data.player_id.replace("player", "Player ")} activated`)
          setShowPopup(true)
          setTimeout(() => setShowPopup(false), 3000)
        } else if (data.action === "player_removed") {
          setPopupMessage(`🚫 ${data.player_id.replace("player", "Player ")} deactivated`)
          setShowPopup(true)
          setTimeout(() => setShowPopup(false), 3000)
        }
      } else if (data.action === "error") {
        console.error("Error from server:", data.message)
        setPopupMessage(`❌ ${data.message}`)
        setShowPopup(true)
        setTimeout(() => setShowPopup(false), 3000)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  const sendWebSocketMessage = (message: any) => {
    if (socket && isConnected) {
      console.log("Sending message to server:", message)
      socket.send(JSON.stringify(message))
    } else {
      setPopupMessage("⚠️ Not connected to server")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
    }
  }

  const activatePlayer = (playerId: string) => {
    sendWebSocketMessage({
      action: "activate_player",
      player_id: playerId
    })
  }

  const deactivatePlayer = (playerId: string) => {
    sendWebSocketMessage({
      action: "remove_player",
      player_id: playerId
    })
  }

  const assignCard = () => {
    if (!selectedPlayer || !selectedCard || !selectedSuit) {
      setPopupMessage("⚠️ Please select player, card, and suit")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Ensure player is active
    if (!gameState?.players[selectedPlayer]?.status) {
      setPopupMessage("⚠️ Player must be active to add cards")
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    const cardCode = selectedCard + selectedSuit
    console.log("Sending card to server:", {
      action: "hit_player",
      player_id: selectedPlayer,
      hand_index: 0,
      card: cardCode
    })

    sendWebSocketMessage({
      action: "hit_player",
      player_id: selectedPlayer,
      hand_index: 0,
      card: cardCode
    })

    // Clear selections after sending
    setSelectedCard(null)
    setSelectedSuit(null)
  }

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
    sendWebSocketMessage({
      action: "reset_game"
    })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 p-4">
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
            <button
              onClick={resetGame}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center space-x-3 font-semibold"
            >
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>New Game</span>
            </button>
          </div>
          </div>
        </div>

      {/* Dealer Window */}
      <div className="max-w-7xl mx-auto mb-8 relative z-10">
        <div className="bg-gradient-to-br from-red-800/80 to-red-700/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-red-600">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              Dealer Status
            </h2>
            <div className="flex items-center space-x-4">
              <div
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  gameState?.dealer?.status === "playing"
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : gameState?.dealer?.status === "bust"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                }`}
              >
                {gameState?.dealer?.status || "waiting"}
              </div>
              <div className="text-sm text-gray-400">Cards in Deck: {gameState?.deck_count || 0}</div>
            </div>
        </div>

          <div className="bg-black/20 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-medium text-white">Dealer's Cards</div>
              <div className="text-2xl font-bold mb-2">
                Total:{" "}
                <span
                  className={`
                  ${dealerTotal > 21
                    ? "text-red-400"
                    : dealerTotal === 21
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {dealerTotal}
                </span>
              </div>
            </div>
            <div className="flex space-x-4 mb-6">
              {gameState?.dealer?.cards?.map((card: string, index: number) => (
                <div key={index} className="w-16 h-24 transform hover:scale-110 transition-transform duration-200">
                  <img src={`/cards/${card}.png`} alt={card} className="w-full h-full object-contain drop-shadow-xl" />
                </div>
              ))}
              {gameState?.dealer?.hidden_card && !gameState?.dealer?.revealed && (
                <div className="w-16 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-xl flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
                  <span className="text-white text-2xl">?</span>
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
                  className="w-16 h-24 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50 transform hover:scale-110 transition-transform duration-200"
                >
                  <span className="text-gray-400 text-xs">Empty</span>
                </div>
              ))}
            </div>

            {/* Dealer Controls */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-4">
                        <button
                  onClick={handleHitDealer}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2"
                        >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Hit Dealer</span>
                        </button>
                        <button
                  onClick={handleRevealDealer}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>Reveal Card</span>
                        </button>
                        <button
                  onClick={handleStandDealer}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2"
                        >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Stand</span>
                        </button>
              </div>
                      </div>
                          </div>
                        </div>
                          </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
        {/* Players Section */}
        <div className="bg-gradient-to-br from-red-800/80 to-red-700/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-red-600">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-3 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Players
            </h2>
            <div className="text-sm text-gray-200">
              Active: {Object.values(gameState?.players || {}).filter((p) => p.status === 1).length}/6
            </div>
                              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(gameState?.players || {}).map(([playerId, playerData]) => (
              <div
                key={playerId}
                className={`p-5 rounded-xl transition-all duration-300 transform hover:scale-[1.02] cursor-pointer ${
                  selectedPlayer === playerId
                    ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-2xl shadow-yellow-500/25 ring-2 ring-yellow-400"
                    : playerData.status === 1
                      ? "bg-gradient-to-br from-red-600/80 to-red-500/80 text-white shadow-xl hover:shadow-red-500/25 border border-red-400/30"
                      : "bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 hover:bg-red-600/80 border border-red-500/30"
                }`}
                onClick={() => {
                  if (playerData.status === 1) {
                    setSelectedPlayer(playerId)
                  }
                }}
              >
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-4 h-4 rounded-full shadow-lg ${
                          playerData.status === 1 ? "bg-green-400 animate-pulse" : "bg-gray-400"
                        }`}
                      />
                      <div>
                        <div className="text-lg font-bold">{playerId.replace("player", "Player ")}</div>
                        <div className="text-sm opacity-75">{playerData.status === 1 ? "Active" : "Inactive"}</div>
                      </div>
                              </div>
                    {playerData.status === 0 ? (
                              <button
                        onClick={(e) => {
                          e.stopPropagation()
                          activatePlayer(playerId)
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                        <span>Activate</span>
                              </button>
                    ) : (
                                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deactivatePlayer(playerId)
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Deactivate</span>
                                      </button>
                    )}
                  </div>

                  {playerData.status === 1 && (
                    <div className="space-y-4">
                      {/* Cards Display */}
                      <div className="bg-black/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-white">Cards:</div>
                                      <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!socket || !isConnected) {
                                setPopupMessage("⚠️ Not connected to server")
                                setShowPopup(true)
                                setTimeout(() => setShowPopup(false), 3000)
                                return
                              }

                              if (playerData.status !== 1) {
                                setPopupMessage("⚠️ Player must be active to add cards")
                                setShowPopup(true)
                                setTimeout(() => setShowPopup(false), 3000)
                                return
                              }

                              console.log("Adding card for player:", playerId)
                              console.log("Current player state:", playerData)

                              sendWebSocketMessage({
                                action: "hit_player",
                                player_id: playerId,
                                hand_index: 0,
                              })

                              setPopupMessage(`🃏 Adding card to ${playerId.replace("player", "Player ")}`)
                              setShowPopup(true)
                              setTimeout(() => setShowPopup(false), 3000)
                            }}
                            className="px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                            <span>Add Card</span>
                                      </button>
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
                              className="w-12 h-16 border-2 border-dashed border-gray-400 rounded-lg"
                            />
                          ))}
                        </div>
                        <div className="mt-2">
                          <span
                            className={`text-lg font-bold ${
                              (gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0) > 21
                                ? "text-red-400"
                                : (gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0) === 21
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }`}
                          >
                            {gameState?.players?.[playerId]?.hands?.[0]?.total ?? 0}
                          </span>
                        </div>
                                  </div>
                                </div>
                              )}
                </div>
                            </div>
            ))}
                            </div>
                          </div>

        {/* Card Selection Section */}
        {selectedPlayer && (
          <div className="bg-gradient-to-br from-red-800/80 to-red-700/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-red-600">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Deal Card to {selectedPlayer.replace("player", "Player ")}
            </h2>

            {/* Card Values */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Card Value:</h3>
              <div className="grid grid-cols-7 gap-2">
                {cardValues.map((value) => (
                                <button
                    key={value}
                    className={`p-3 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
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
                    className={`p-4 rounded-xl text-4xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3 ${
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
              <div className="flex flex-col items-center gap-6 mt-8">
                <div className="relative">
                  <div className="w-32 h-44 transform hover:scale-110 transition-transform duration-300">
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
                  onClick={assignCard}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-12 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center space-x-3 text-lg"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        )}
            </div>

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
