'use client'
import { useState, useEffect, useRef } from 'react'

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

// Add these helper functions at the top of the file, after the interfaces
const isHandSelected = (
  gameState: GameState | null,
  playerId: string,
  handIndex: number,
  splitLevel: number
): boolean => {
  return (
    gameState?.selected_hand?.player_id === playerId &&
    gameState?.selected_hand?.hand_index === handIndex &&
    gameState?.selected_hand?.split_level === splitLevel
  )
}

const canSplit = (cards: string[]): boolean => {
  if (cards.length !== 2) return false
  // Only compare the rank (first character)
  return cards[0][0] === cards[1][0]
}

const DebugPanel = ({ gameState }: { gameState: GameState | null }) => {
  if (!gameState) return null

  // Group players into rows of 3
  const playerEntries = Object.entries(gameState.players)
  const playerRows = []
  for (let i = 0; i < playerEntries.length; i += 3) {
    playerRows.push(playerEntries.slice(i, i + 3))
  }

  return <></>
}

const GameMenu = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isRoundFinished, setIsRoundFinished] = useState(false)
  const [showNextButton, setShowNextButton] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [popupMessage, setPopupMessage] = useState('')
  const [isDealerSelected, setIsDealerSelected] = useState(false)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedSuit, setSelectedSuit] = useState<string | null>(null)
  const [insuranceState, setInsuranceState] = useState<{
    [key: string]: boolean
  }>({})
  const [lastPlayerTotal, setLastPlayerTotal] = useState<{
    [key: string]: number
  }>({})
  const lastDealerTotalRef = useRef(0)
  const lastPlayerTotalRef = useRef<{ [key: string]: number }>({})
  const nextTurnCalledRef = useRef<{ [key: string]: boolean }>({})
  const [waitingForServer, setWaitingForServer] = useState(false)
  const lastAutoTurnRef = useRef<{
    playerId: string | null
    round: number
    count: number
  }>({ playerId: null, round: -1, count: -1 })

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout
    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 5
    const RECONNECT_DELAY = 3000

    const connect = () => {
      ws = new WebSocket('ws://localhost:6790')

      ws.onopen = () => {
        console.log('Connected to server')
        setIsConnected(true)
        reconnectAttempts = 0
      }

      ws.onclose = () => {
        console.log('Disconnected from server')
        setIsConnected(false)

        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(
            `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
          )
          reconnectTimeout = setTimeout(connect, RECONNECT_DELAY)
        } else {
          console.log('Max reconnection attempts reached')
          setPopupMessage('⚠️ Connection lost. Please refresh the page.')
          setShowPopup(true)
        }
      }

      ws.onerror = error => {
        console.error('WebSocket error:', error)
        setPopupMessage('⚠️ Connection error occurred')
        setShowPopup(true)
      }

      ws.onmessage = event => {
        const data = JSON.parse(event.data)
        console.log('Received:', data)

        // Update game state for all relevant actions
        if (data.game_state) {
          setGameState(data.game_state)
        }

        // Handle specific actions
        switch (data.action) {
          case 'player_activated':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
            break
          case 'player_removed':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
            break
          case 'turn_updated':
            setIsDealerSelected(data.current_turn === 'dealer')
            break
          case 'game_started':
            setIsPlaying(true)
            setIsGameStarted(true)
            setIsRoundFinished(false)
            setShowNextButton(true)
            setIsDealerSelected(data.current_turn === 'dealer')
            setLastPlayerTotal({}) // Reset player totals
            lastDealerTotalRef.current = 0 // Reset dealer ref
            lastPlayerTotalRef.current = {} // Reset player ref
            nextTurnCalledRef.current = {} // Reset next turn called ref
            console.log('Manual distribution counter reset to 0 (game started)')
            break
          case 'round_reset':
            setIsPlaying(false)
            setIsGameStarted(false)
            setIsDealerSelected(false)
            setShowNextButton(false)
            setIsRoundFinished(true)
            setLastPlayerTotal({}) // Reset player totals
            lastDealerTotalRef.current = 0 // Reset dealer ref
            lastPlayerTotalRef.current = {} // Reset player ref
            nextTurnCalledRef.current = {} // Reset next turn called ref
            console.log('Manual distribution counter reset to 0 (round reset)')
            break
          case 'game_reset':
            // Reset all local state
            setIsPlaying(false)
            setIsGameStarted(false)
            setIsRoundFinished(false)
            setShowNextButton(false)
            setIsDealerSelected(false)
            setSelectedCard(null)
            setSelectedSuit(null)
            setLastPlayerTotal({}) // Reset player totals
            lastDealerTotalRef.current = 0 // Reset dealer ref
            lastPlayerTotalRef.current = {} // Reset player ref
            nextTurnCalledRef.current = {} // Reset next turn called ref
            console.log('Manual distribution counter reset to 0 (game reset)')
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 3000)
            break
          case 'error':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
            break
          case 'split1_activated':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
            break
          case 'split2_activated':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
            break
          case 'player_hit':
          case 'dealer_hit':
            setWaitingForServer(false)
            break
        }
      }

      setSocket(ws)
    }

    connect()

    return () => {
      if (ws) {
        ws.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [])

  const handleMainContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Only clear dealer selection, player selection is managed by backend
      setIsDealerSelected(false)
    }
  }

  const activatePlayer = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send selection to backend first
    sendWebSocketMessage({
      action: 'select_player',
      player_id: playerId
    })

    // Then activate the player
    sendWebSocketMessage({
      action: 'activate_player',
      player_id: playerId
    })
  }

  const deactivatePlayer = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Clear selection if deactivating selected player
    if (gameState?.selected_hand?.player_id === playerId) {
      sendWebSocketMessage({
        action: 'select_player',
        player_id: null
      })
    }

    sendWebSocketMessage({
      action: 'remove_player',
      player_id: playerId
    })
  }

  const handlePlayerClick = (playerId: string) => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send selection to backend
    sendWebSocketMessage({
      action: 'select_player',
      player_id: playerId
    })
  }

  const startGameLoop = () => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Check if there are any active players
    const activePlayers = getActivePlayers()
    if (activePlayers.length === 0) {
      setPopupMessage('⚠️ No active players')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Send start game message
    sendWebSocketMessage({
      action: 'start_game'
    })

    // Update UI states
    setIsPlaying(true)
    setIsGameStarted(true)
    setIsRoundFinished(false)
    setShowNextButton(true)
    setPopupMessage('🎮 Game started!')
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const stopGameLoop = () => {
    if (gameState?.game_phase === 'playing') {
      sendWebSocketMessage({
        action: 'reset_round'
      })
    }
    setIsPlaying(false)
    setIsGameStarted(false)
    setIsDealerSelected(false)
    setShowNextButton(false)
    setIsRoundFinished(true)
    setPopupMessage('🛑 Game stopped')
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const sendWebSocketMessage = (message: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('Sending message to server:', message)
      socket.send(JSON.stringify(message))
    } else {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
    }
  }

  // Add this new function to get active players
  const getActivePlayers = () => {
    if (!gameState) return []
    return Object.entries(gameState.players)
      .filter(([_, data]) => data.status === 1)
      .map(([id]) => id)
  }

  const cardValues = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'T',
    'J',
    'Q',
    'K'
  ]
  const suits = [
    { symbol: '♠', value: 'S', color: 'text-gray-800', name: 'Spades' },
    { symbol: '♦', value: 'D', color: 'text-red-500', name: 'Diamonds' },
    { symbol: '♣', value: 'C', color: 'text-gray-800', name: 'Clubs' },
    { symbol: '♥', value: 'H', color: 'text-red-500', name: 'Hearts' }
  ]

  // Update the dealer total check
  const dealerTotal = gameState?.dealer?.total ?? 0

  const handleNextTurn = () => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    sendWebSocketMessage({
      action: 'next_turn'
    })
  }

  const handleStandDealer = () => {
    sendWebSocketMessage({
      action: 'stand_dealer'
    })
  }

  const resetGame = () => {
    if (!socket || !isConnected) {
      setPopupMessage('⚠️ Not connected to server')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    // Reset all local state
    setIsPlaying(false)
    setIsGameStarted(false)
    setIsRoundFinished(false)
    setShowNextButton(false)
    setIsDealerSelected(false)
    setSelectedCard(null)
    setSelectedSuit(null)

    // Send reset game message to server
    sendWebSocketMessage({
      action: 'reset_game'
    })

    setPopupMessage('🔄 Game has been reset')
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const assignCard = () => {
    if (waitingForServer) return // Prevent double send

    if (gameState?.game_phase === 'dealer' && selectedCard && selectedSuit) {
      // Allow dealing card to dealer
      const cardCode = selectedCard + selectedSuit
      setWaitingForServer(true)
      sendWebSocketMessage({
        action: 'hit_dealer',
        card: cardCode
      })
      setSelectedCard(null)
      setSelectedSuit(null)
      setIsDealerSelected(false)
      return
    }
    if (
      !gameState?.selected_hand?.player_id ||
      !selectedCard ||
      !selectedSuit
    ) {
      setPopupMessage('⚠️ Please select player, card, and suit')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }
    // Ensure player is active
    if (!gameState?.players[gameState.selected_hand.player_id]?.status) {
      setPopupMessage('⚠️ Player must be active to add cards')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }
    const cardCode = selectedCard + selectedSuit
    setWaitingForServer(true)
    // Send the hit_player action
    sendWebSocketMessage({
      action: 'hit_player',
      player_id: gameState.selected_hand.player_id,
      hand_index: gameState.selected_hand.hand_index,
      card: cardCode
    })
    setSelectedCard(null)
    setSelectedSuit(null)
  }

  const handleInsurance = (
    playerId: string,
    handIndex: number,
    splitLevel: number = 0
  ) => {
    sendWebSocketMessage({
      action: 'handle_insurance',
      player_id: playerId,
      hand_index: handIndex,
      split_level: splitLevel
    })
    setInsuranceState(prev => ({
      ...prev,
      [`${playerId}_${handIndex}_${splitLevel}`]: true
    }))
  }

  const clearInsuranceForHand = (
    playerId: string,
    handIndex: number,
    splitLevel: number = 0
  ) => {
    setInsuranceState(prev => {
      const newState = { ...prev }
      delete newState[`${playerId}_${handIndex}_${splitLevel}`]
      return newState
    })
  }

  // Helper to get hand color class
  const getHandBoxColor = (selected: boolean, result?: string) => {
    if (selected) return 'bg-yellow-300 border-2 border-yellow-500'
    if (result === 'fail')
      return 'bg-red-500 border-2 border-red-700 text-white'
    if (result === 'win')
      return 'bg-green-500 border-2 border-green-700 text-white'
    if (result === 'tie')
      return 'bg-purple-500 border-2 border-purple-700 text-white'
    return 'bg-black/20'
  }

  return (
    <div className='min-h-screen bg-[#450A03] text-white p-8'>
      {/* Main Content Area */}
      <div className=' flex flex-col p-4'>
        <div className='flex-1 border-4 border-yellow-600 bg-[#911606] p-4 '>
          <div className='h-full flex flex-col'>
            <div className='flex items-start gap-4 mb-4'>
              {/* Dealer Area */}
              <div className='flex-1 border-2 border-dashed border-yellow-600 rounded-lg p-4 bg-red-800/50 flex-shrink-0'>
                <div className='flex items-start justify-between mb-4'>
                  <h2 className='text-lg font-bold text-yellow-300'>
                    Dealer's Cards
                  </h2>
                  <div className='flex flex-col gap-1 items-end space-x-4'>
                    <span className='bg-black/10 px-3 py-1 rounded-2xl text-sm border border-red-200'>
                      Total: {dealerTotal}
                    </span>
                    <button
                      onClick={() =>
                        sendWebSocketMessage({ action: 'manual_start' })
                      }
                      className='bg-yellow-600 hover:bg-yellow-700 text-red-900 px-4 py-2 rounded font-light text-sm'
                    >
                      Manual Start
                    </button>
                    <button
                      onClick={() =>
                        sendWebSocketMessage({ action: 'reset_game' })
                      }
                      className='bg-white hover:bg-gray-100 text-red-900 px-4 py-2 rounded font-light text-sm border'
                    >
                      New Game
                    </button>
                  </div>
                </div>

                {/* <div className='flex justify-center space-x-4 mb-4'> */}
                {/* {gameState?.dealer?.cards?.map(
                    (card: string, index: number) => (
                      <div key={index} className='w-16 h-24'>
                        <img
                          src={`/cards/${card}.png`}
                          alt={card}
                          className='w-full h-full object-contain'
                        />
                      </div>
                    )
                  )} */}
                {/* Empty card slots */}
                {/* {[
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
                  ))} */}
                {/* </div> */}
              </div>

              {/* Mode Selection Buttons */}
              <div className='flex space-x-2 flex-shrink-0'>
                <button className='px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 border border-gray-300'>
                  Live
                </button>
                <button className='px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 border-t border-b border-gray-300'>
                  Automatic
                </button>
                <button className='px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 border border-red-600'>
                  Manual
                </button>
              </div>
            </div>

            {/* Players Grid - 2x3 layout */}
            <div className='flex-1 grid grid-cols-3 gap-2 overflow-hidden'>
              {Object.entries(gameState?.players || {})
                .slice(0, 6)
                .map(([playerId, playerData], index) => {
                  const isCurrentHand =
                    gameState?.selected_hand?.player_id === playerId
                  const isActive = playerData.status === 1

                  return (
                    <div
                      key={playerId}
                      className='border-2 border-dashed border-yellow-600 rounded-lg p-2 bg-red-800/50 flex flex-col'
                      onClick={e => {
                        e.stopPropagation()
                        if (isActive) {
                          handlePlayerClick(playerId)
                        }
                      }}
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <h3 className='text-xs font-bold text-yellow-300'>
                          Player {index + 1}
                        </h3>
                        {!isActive ? (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              activatePlayer(playerId)
                            }}
                            className='bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-xs font-semibold'
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              deactivatePlayer(playerId)
                            }}
                            className='bg-transparent border border-white/50 hover:bg-white/10 text-white px-2 py-0.5 rounded text-xs font-semibold backdrop-blur-sm'
                          >
                            Deactivate
                          </button>
                        )}
                      </div>

                      {isActive && (
                        <>
                          {/* Check if any split is active to determine layout */}
                          {gameState?.players?.[playerId]?.split1_status === 1 || 
                           gameState?.players?.[playerId]?.split2_status === 1 ? (
                            /* Vertical layout when splits are active */
                            <div className='flex space-y-2'>
                              {/* Main Hand */}
                              <div className='flex justify-center items-center w-fit mx-auto'>
                                <div className='bg-black/10 border border-yellow-600 rounded-lg p-2 w-full'>
                                  <div className='text-xs text-white mb-1 text-center font-semibold'>
                                    Main Hand
                                  </div>
                                  <div className='flex flex-col space-y-1'>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-green-500 text-white border border-white rounded hover:bg-green-600 transition-colors text-xs font-semibold'
                                    >
                                      WIN
                                    </button>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-red-500 text-white border border-white rounded hover:bg-red-600 transition-colors text-xs font-semibold'
                                    >
                                      LOSE
                                    </button>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-purple-500 text-white border border-white rounded hover:bg-purple-600 transition-colors text-xs font-semibold'
                                    >
                                      TIE
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Split1 Hand */}
                              {gameState?.players?.[playerId]?.split1_status === 1 && (
                                <div className='flex justify-center items-center w-fit mx-auto'>
                                  <div className='bg-black/10 border border-yellow-600 rounded-lg p-2 w-full'>
                                    <div className='text-xs text-white mb-1 text-center font-semibold flex items-center justify-between'>
                                      <span>Split 1</span>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'deactivate_split1',
                                            player_id: playerId
                                          })
                                        }
                                        className='px-1.5 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-xs'
                                      >
                                        Deactivate
                                      </button>
                                    </div>
                                    <div className='flex flex-col space-y-1'>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-green-500 text-white border border-white rounded hover:bg-green-600 transition-colors text-xs font-semibold'
                                      >
                                        WIN
                                      </button>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-red-500 text-white border border-white rounded hover:bg-red-600 transition-colors text-xs font-semibold'
                                      >
                                        LOSE
                                      </button>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-purple-500 text-white border border-white rounded hover:bg-purple-600 transition-colors text-xs font-semibold'
                                      >
                                        TIE
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Split2 Hand */}
                              {gameState?.players?.[playerId]?.split2_status === 1 && (
                                <div className='flex justify-center items-center w-fit mx-auto'>
                                  <div className='bg-black/10 border border-yellow-600 rounded-lg p-2 w-full'>
                                    <div className='text-xs text-white mb-1 text-center font-semibold flex items-center justify-between'>
                                      <span>Split 2</span>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'deactivate_split2',
                                            player_id: playerId
                                          })
                                        }
                                        className='px-1.5 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-xs'
                                      >
                                        Deactivate
                                      </button>
                                    </div>
                                    <div className='flex flex-col space-y-1'>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-green-500 text-white border border-white rounded hover:bg-green-600 transition-colors text-xs font-semibold'
                                      >
                                        WIN
                                      </button>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-red-500 text-white border border-white rounded hover:bg-red-600 transition-colors text-xs font-semibold'
                                      >
                                        LOSE
                                      </button>
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'manual_handle_result'
                                          })
                                        }
                                        className='px-2 py-1 bg-purple-500 text-white border border-white rounded hover:bg-purple-600 transition-colors text-xs font-semibold'
                                      >
                                        TIE
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Activate buttons for inactive splits */}
                              {gameState?.players?.[playerId]?.split1_status !== 1 && (
                                <div className='flex justify-center'>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      sendWebSocketMessage({
                                        action: 'activate_split1',
                                        player_id: playerId
                                      })
                                    }}
                                    className='px-3 py-1 bg-black/40 border border-yellow-400 text-yellow-400 rounded hover:bg-black/60 transition-colors text-xs font-semibold'
                                  >
                                    Activate Split 1
                                  </button>
                                </div>
                              )}

                              {gameState?.players?.[playerId]?.split2_status !== 1 && (
                                <div className='flex justify-center'>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      sendWebSocketMessage({
                                        action: 'activate_split2',
                                        player_id: playerId
                                      })
                                    }}
                                    className='px-3 py-1 bg-black/40 border border-yellow-400 text-yellow-400 rounded hover:bg-black/60 transition-colors text-xs font-semibold'
                                  >
                                    Activate Split 2
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Original layout when no splits are active */
                            <>
                              {/* Main Hand - Centered with background */}
                              <div className='mb-2 flex justify-center items-center w-fit mx-auto'>
                                <div className='bg-black/10 border border-yellow-600 rounded-lg p-2 w-full'>
                                  <div className='text-xs text-white mb-1 text-center font-semibold'>
                                    Main Hand
                                  </div>
                                  <div className='flex justify-center space-x-1'>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-green-500 text-white border border-white rounded hover:bg-green-600 transition-colors text-xs font-semibold'
                                    >
                                      WIN
                                    </button>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-red-500 text-white border border-white rounded hover:bg-red-600 transition-colors text-xs font-semibold'
                                    >
                                      LOSE
                                    </button>
                                    <button
                                      onClick={() =>
                                        sendWebSocketMessage({
                                          action: 'manual_handle_result'
                                        })
                                      }
                                      className='px-2 py-1 bg-purple-500 text-white border border-white rounded hover:bg-purple-600 transition-colors text-xs font-semibold'
                                    >
                                      TIE
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Activate Split 1 Button */}
                              <div className='mb-2 flex justify-center'>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    sendWebSocketMessage({
                                      action: 'activate_split1',
                                      player_id: playerId
                                    })
                                  }}
                                  className='px-3 py-1 bg-black/40 border border-yellow-400 text-yellow-400 rounded hover:bg-black/60 transition-colors text-xs font-semibold'
                                >
                                  Activate Split 1
                                </button>
                              </div>

                              {/* Activate Split 2 Button */}
                              <div className='mb-2 flex justify-center'>
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    sendWebSocketMessage({
                                      action: 'activate_split2',
                                      player_id: playerId
                                    })
                                  }}
                                  className='px-3 py-1 bg-black/40 border border-yellow-400 text-yellow-400 rounded hover:bg-black/60 transition-colors text-xs font-semibold'
                                >
                                  Activate Split 2
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {/* Next Button - Show for current player */}
                      {isActive && gameState?.current_turn === 'player' && (
                        <div className='mt-auto flex justify-end'>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleNextTurn()
                            }}
                            className='px-2 py-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-1 text-xs'
                          >
                            <svg
                              className='w-3 h-3'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M13 5l7 7-7 7M5 5l7 7-7 7'
                              />
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
        </div>
      </div>

      {/* DebugPanel at the end */}
      <DebugPanel gameState={gameState} />

      {/* Enhanced Popup Message */}
      {showPopup && (
        <div className='fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce'>
          <div className='bg-gradient-to-r from-red-800 to-red-700 border border-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-xl'>
            <div className='w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse'></div>
            <span className='font-medium text-lg'>{popupMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameMenu
