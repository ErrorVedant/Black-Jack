'use client'
import { useState, useEffect, useRef } from 'react'
import PlayerBoard from '@/components/PlayerBoard'
import Image from 'next/image'

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
  insurence?: number
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
  evaluate_game: boolean
  mode: string
}

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
  return cards[0][0] === cards[1][0]
}

const DebugPanel = ({ gameState }: { gameState: GameState | null }) => {
  if (!gameState) return null
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
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [playerResult, setPlayerResult] = useState<string>('')

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

        if (data.game_state) {
          setGameState(data.game_state)
        }

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
            setShowResultPopup(false)
            setPlayerResult('')
            break
          case 'round_reset':
            setIsPlaying(false)
            setIsGameStarted(false)
            setIsDealerSelected(false)
            setShowNextButton(false)
            setIsRoundFinished(true)
            setShowResultPopup(false)
            setPlayerResult('')
            break
          case 'game_reset':
            setIsPlaying(false)
            setIsGameStarted(false)
            setIsRoundFinished(false)
            setShowNextButton(false)
            setIsDealerSelected(false)
            setSelectedCard(null)
            setSelectedSuit(null)
            setShowResultPopup(false)
            setPlayerResult('')
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 3000)
            break
          case 'game_evaluated':
            setShowResultPopup(true)
            // Get player2's result
            const player2Data = data.game_state?.players?.player2
            if (player2Data) {
              const mainHandResult = player2Data.hands?.[0]?.result
              const split1Result = player2Data.split1?.[0]?.result
              const split2Result = player2Data.split2?.[0]?.result

              // Determine overall result (prioritize wins, then ties, then losses)
              let overallResult = 'lose'
              if (
                mainHandResult === 'win' ||
                split1Result === 'win' ||
                split2Result === 'win'
              ) {
                overallResult = 'win'
              } else if (
                mainHandResult === 'tie' ||
                split1Result === 'tie' ||
                split2Result === 'tie'
              ) {
                overallResult = 'tie'
              }

              setPlayerResult(overallResult)
            }
            break
          case 'error':
            setPopupMessage(data.message)
            setShowPopup(true)
            setTimeout(() => setShowPopup(false), 1000)
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

    sendWebSocketMessage({
      action: 'select_player',
      player_id: playerId
    })

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

    const activePlayers = getActivePlayers()
    if (activePlayers.length === 0) {
      setPopupMessage('⚠️ No active players')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }

    sendWebSocketMessage({
      action: 'start_game'
    })

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

    setIsPlaying(false)
    setIsGameStarted(false)
    setIsRoundFinished(false)
    setShowNextButton(false)
    setIsDealerSelected(false)
    setSelectedCard(null)
    setSelectedSuit(null)

    sendWebSocketMessage({
      action: 'reset_game'
    })

    setPopupMessage('🔄 Game has been reset')
    setShowPopup(true)
    setTimeout(() => setShowPopup(false), 3000)
  }

  const assignCard = () => {
    if (gameState?.game_phase === 'dealer' && selectedCard && selectedSuit) {
      const cardCode = selectedCard + selectedSuit
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
    if (!gameState?.players[gameState.selected_hand.player_id]?.status) {
      setPopupMessage('⚠️ Player must be active to add cards')
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
      return
    }
    const cardCode = selectedCard + selectedSuit
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

  const player2Active = gameState?.players?.player2?.status === 1

  // Helper to get hand color class (match dealer/auto/page.tsx)
  const getHandBoxColor = (
    selected: boolean,
    isActive: boolean,
    result?: string
  ) => {
    if (selected) return 'bg-yellow-300 border-2 border-yellow-500'
    if (result === 'fail')
      return 'bg-red-500 border-2 border-red-700 text-white'
    if (result === 'win')
      return 'bg-green-500 border-2 border-green-700 text-white'
    if (result === 'tie')
      return 'bg-purple-500 border-2 border-purple-700 text-white'
    if (isActive)
      return 'bg-gradient-to-br from-blue-600/80 to-blue-500/80 text-white shadow-xl border border-blue-400/30'
    return 'bg-gradient-to-br from-red-700/80 to-red-600/80 text-gray-200 border border-red-500/30'
  }

  return (
    <div className='min-h-screen w-screen bg-[#450A03]'>
      {player2Active ? (
        <div className='min-h-screen bg-[#450A03] text-white p-8'>
          <nav className='fixed top-0 left-0 right-0 h-[12vh] w-full overflow-hidden z-50 shadow-lg'>
                      <img
                        src='/assets/wood.png'
                        alt='Wood Background'
                        className='absolute inset-0 object-cover w-full h-full'
                      />
                      <div className='relative h-full'>
                        <div className='flex items-center justify-between h-full px-2 xs:px-4 sm:px-6 md:px-8 lg:px-12'>
                          {/* Left Logo - Optimized for 1112x800 */}
                          <div
                            className='w-16 h-16 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 relative flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform'
                            aria-label='Open Bet/Table Menu'
                          >
                            <div className='relative w-24 h-24'>
                              <Image
                                src='/assets/logo.png'
                                alt='Casino Wars Logo'
                                fill
                                className='object-contain'
                                sizes='(max-width: 640px) 32px, (max-width: 768px) 40px, (max-width: 1024px) 48px, (max-width: 1280px) 64px, 64px'
                                priority
                              />
                            </div>
                            <span className='text-yellow-300 text-xs sm:text-sm lg:text-base -mt-1'>
                              Table: {gameState?.table_number}
                            </span>
                          </div>
          
                          <div className='flex items-center justify-center gap-1 sm:gap-2 md:gap-3 lg:gap-4'>
                            <div className='relative w-20 h-20 cursor-pointer hover:scale-110 transition-transform duration-200'>
                              <Image
                                src='/assets/ocean7.png'
                                alt={`Logo`}
                                fill
                                className='object-contain drop-shadow-lg'
                                sizes='(max-width: 640px) 24px, (max-width: 768px) 32px, (max-width: 1024px) 40px, (max-width: 1280px) 48px, 48px'
                                priority
                              />
                            </div>
                          </div>
          
                          {/* Right Logo - Optimized for 1112x800 */}
                          <div
                            className='w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 relative flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden mr-4'
                            aria-label='Open Game Menu'
                          >
                            <div className='flex flex-col items-end justify-center w-full h-full'>
                              <h1 className='text-yellow-500'>Bets: </h1>
                              <span className='text-yellow-500'>min: 0</span>
                              <span className='text-yellow-500'>max: 0</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </nav>

          {/* Main Content Area */}
          <div className='pt-[8vh]'>
          <div className='mx-auto max-w-7xl px-4'>
            <div className='bg-[#911606] border-4 border-[#d4af37] p-6 w-full grow flex flex-col rounded-lg'>
              {/* Player Number and Status */}
              <div className='text-center mb-4'>
                <h2 className='text-3xl sm:text-4xl font-semibold text-[#d4af37] font-[questrial] tracking-widest mb-2'>
                  PLAYER 2
                </h2>

                {/* Status Display */}
                <div className='flex justify-center'>
                  <div className='inline-block px-4 sm:px-6 py-1.5 sm:py-2 bg-[#7a1105] text-white font-semibold rounded shadow-md'>
                    <span className='font-semibold'>Status: </span>
                    <span className='text-yellow-300'>
                      {gameState?.players?.player2?.status === 1
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                    {gameState?.game_phase && (
                      <>
                        <span className='mx-2'>|</span>
                        <span className='font-semibold'>Phase: </span>
                        <span className='text-green-300'>
                          {gameState.game_phase}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Dealer Section */}
              <div className='relative bg-[#a42210] border-2 border-[#d4af37] p-4 sm:p-6 rounded-xl mb-6 sm:mb-8 shadow-md'>
                <h3 className='text-xl font-medium font-[questrial] tracking-widest text-white mb-4'>
                  Dealer's Hand
                </h3>

                <div className='flex justify-center items-center gap-4 min-h-[120px] mb-4'>
                  {gameState.mode !== 'manual' &&
                    gameState?.dealer?.cards?.map(
                      (card: string, index: number) => (
                        <div
                          key={index}
                          className='w-16 h-24 transform hover:scale-110 transition-transform duration-200'
                        >
                          <img
                            src={`/cards/${card}.png`}
                            alt={card}
                            className='w-full h-full object-contain drop-shadow-xl'
                          />
                        </div>
                      )
                    )}
                  {gameState.mode !== 'manual' &&
                    [
                      ...Array(
                        Math.max(0, 2 - (gameState?.dealer?.cards?.length || 0))
                      )
                    ].map((_, index) => (
                      <div
                        key={`empty-${index}`}
                        className='w-16 h-24 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50 transform hover:scale-110 transition-transform duration-200'
                      >
                        <span className='text-gray-400 text-xs'>Empty</span>
                      </div>
                    ))}
                </div>
                <div className='absolute top-[93%] left-[43%] text-center'>
                  <div className='inline-block bg-[#911606] px-3 py-1 rounded-full text-sm font-bold text-[#d4af37] border-2 border-[#d4af37]'>
                    Total: {dealerTotal}
                  </div>
                </div>

                {gameState?.game_phase === 'dealer' && (
                  <div className='flex items-center justify-center space-x-3 mt-4'></div>
                )}
              </div>

              {/* Player 2 - Large Panel */}
              {gameState?.players?.player2 && (
                <div className='text-center'>
                  <div
                    className='bg-[#a42210] border-2 border-[#d4af37] p-4 sm:p-6 rounded-xl mb-6 sm:mb-8 shadow-md transition-all duration-300 relative'
                    onClick={e => {
                      e.stopPropagation()
                      if (gameState.players.player2.status === 1) {
                        handlePlayerClick('player2')
                      }
                    }}
                  >
                    <div className='flex items-center justify-between mb-4'>
                      <div className='flex items-center space-x-4'>
                        <div
                          className={`w-5 h-5 rounded-full shadow-lg ${
                            isHandSelected(gameState, 'player2', 0, 0)
                              ? 'bg-blue-400 animate-pulse'
                              : gameState.players.player2.status === 1
                              ? 'bg-green-400 animate-pulse'
                              : 'bg-gray-400'
                          }`}
                        />
                        <div>
                          <div
                            className={`text-xl font-medium font-[questrial] tracking-widest ${
                              isHandSelected(gameState, 'player2', 0, 0)
                                ? 'text-gray-900'
                                : 'text-white'
                            }`}
                          >
                            Your Hand
                            {gameState.players.player2.insurence === 1 && (
                              <span className='ml-3 text-yellow-400 text-base font-semibold'>
                                Insured
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-base ${
                              isHandSelected(gameState, 'player2', 0, 0)
                                ? 'text-gray-700'
                                : 'opacity-75'
                            }`}
                          >
                            {isHandSelected(gameState, 'player2', 0, 0)
                              ? 'Current Hand'
                              : gameState.players.player2.status === 1
                              ? 'Active'
                              : 'Inactive'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {gameState.players.player2.status === 1 && (
                      <div className='space-y-6'>
                        {/* Main Hand */}
                        <div
                          className={`rounded-xl p-4 relative ${getHandBoxColor(
                            isHandSelected(gameState, 'player2', 0, 0) &&
                              gameState?.current_player === 'player2',
                            gameState.players.player2.status === 1,
                            gameState.players.player2.hands[0]?.result
                          )}`}
                        >
                          <div className='flex justify-center items-center gap-4 mb-4'>
                            {gameState.players.player2.hands[0]?.cards?.map(
                              (card: string, index: number) => (
                                <div
                                  key={index}
                                  className='relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group'
                                >
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
                            {/* Only show empty slots if not manual mode */}
                            {gameState.mode !== 'manual' &&
                              [
                                ...Array(
                                  Math.max(
                                    0,
                                    2 -
                                      (gameState.players.player2.hands[0]?.cards
                                        ?.length ?? 0)
                                  )
                                )
                              ].map((_, index) => (
                                <div
                                  key={`empty-${index}`}
                                  className='w-16 h-24 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50'
                                />
                              ))}
                          </div>
                          {gameState.mode !== 'manual' && (
                            <div className='absolute top-[90%] left-[43%] text-center'>
                              <div className='inline-block bg-[#911606] px-3 py-1 rounded-full text-sm font-bold text-[#d4af37] border-2 border-[#d4af37]'>
                                Total:{' '}
                                {gameState.players.player2.hands[0]?.total ?? 0}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className='flex justify-center gap-2 flex-wrap mt-8'>
                            {isHandSelected(gameState, 'player2', 0, 0) &&
                              gameState?.current_player === 'player2' &&
                              gameState.players.player2.hands[0]?.cards
                                ?.length === 2 &&
                              canSplit(
                                gameState.players.player2.hands[0].cards
                              ) &&
                              gameState.players.player2.hands[0].status ===
                                'playing' && (
                                <button
                                  onClick={() =>
                                    sendWebSocketMessage({
                                      action: 'split_player_auto',
                                      player_id: 'player2'
                                    })
                                  }
                                  className='px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors'
                                >
                                  Split
                                </button>
                              )}

                            {/* Main Hand Action Buttons for Player 2 */}
                            {isHandSelected(gameState, 'player2', 0, 0) &&
                              gameState?.current_player === 'player2' && (
                                <>
                                  {gameState?.dealer?.cards?.[0]?.[0] === 'A' &&
                                    !insuranceState[`player2_0_0`] &&
                                    !gameState.players.player2.hands[0]
                                      .insurence && (
                                      <button
                                        onClick={() =>
                                          handleInsurance('player2', 0, 0)
                                        }
                                        className='px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors'
                                      >
                                        Insurance
                                      </button>
                                    )}
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'hit_player',
                                        player_id: 'player2',
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand('player2', 0, 0)
                                    }}
                                    className='px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
                                  >
                                    Hit
                                  </button>
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'double_player',
                                        player_id: 'player2',
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand('player2', 0, 0)
                                    }}
                                    className='px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors'
                                  >
                                    Double
                                  </button>
                                  <button
                                    onClick={() => {
                                      sendWebSocketMessage({
                                        action: 'next_turn',
                                        player_id: 'player2',
                                        hand_index: 0
                                      })
                                      clearInsuranceForHand('player2', 0, 0)
                                    }}
                                    className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
                                  >
                                    Stand
                                  </button>
                                </>
                              )}
                          </div>
                        </div>

                        {/* Split1 Hand (manual mode: show if split1_status is 1) */}
                        {gameState.mode === 'manual' &&
                          gameState.players.player2.split1_status === 1 && (
                            <div className='mt-4'>
                              <div
                                className={`rounded-xl p-4 relative ${getHandBoxColor(
                                  isHandSelected(gameState, 'player2', 0, 1) &&
                                    gameState?.current_player === 'player2',
                                  gameState.players.player2.status === 1,
                                  gameState.players.player2.split1[0]?.result
                                )}`}
                              >
                                <div className='text-center mb-3'>
                                  <div
                                    className={`text-lg font-medium ${
                                      isHandSelected(gameState, 'player2', 0, 1)
                                        ? 'text-gray-900'
                                        : 'text-white'
                                    }`}
                                  >
                                    Split Hand 1
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Split2 Hand (manual mode: show if split2_status is 1) */}
                        {gameState.mode === 'manual' &&
                          gameState.players.player2.split2_status === 1 && (
                            <div className='mt-4'>
                              <div
                                className={`rounded-xl p-4 relative ${getHandBoxColor(
                                  isHandSelected(gameState, 'player2', 0, 2) &&
                                    gameState?.current_player === 'player2',
                                  gameState.players.player2.status === 1,
                                  gameState.players.player2.split2[0]?.result
                                )}`}
                              >
                                <div className='text-center mb-3'>
                                  <div
                                    className={`text-lg font-medium ${
                                      isHandSelected(gameState, 'player2', 0, 2)
                                        ? 'text-gray-900'
                                        : 'text-white'
                                    }`}
                                  >
                                    Split Hand 2
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Split1 Hand (auto mode: show if cards exist) */}
                        {gameState.mode !== 'manual' &&
                          gameState.players.player2.split1[0]?.cards?.length >
                            0 && (
                            <div className='mt-4'>
                              <div
                                className={`rounded-xl p-4 relative ${getHandBoxColor(
                                  isHandSelected(gameState, 'player2', 0, 1) &&
                                    gameState?.current_player === 'player2',
                                  gameState.players.player2.status === 1,
                                  gameState.players.player2.split1[0]?.result
                                )}`}
                              >
                                <div className='text-center mb-3'>
                                  <div
                                    className={`text-lg font-medium ${
                                      isHandSelected(gameState, 'player2', 0, 1)
                                        ? 'text-gray-900'
                                        : 'text-white'
                                    }`}
                                  >
                                    Split Hand 1
                                  </div>
                                </div>

                                <div className='flex justify-center items-center gap-4 mb-4'>
                                  {gameState.players.player2.split1[0].cards.map(
                                    (card, index) => (
                                      <div
                                        key={index}
                                        className='relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group'
                                      >
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
                                  {[
                                    ...Array(
                                      Math.max(
                                        0,
                                        2 -
                                          (gameState.players.player2.split1[0]
                                            .cards.length ?? 0)
                                      )
                                    )
                                  ].map((_, index) => (
                                    <div
                                      key={`empty-${index}`}
                                      className='w-16 h-24 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50'
                                    />
                                  ))}
                                </div>

                                <div className='absolute top-[92%] left-[43%] text-center'>
                                  <div className='inline-block bg-[#911606] px-3 py-1 rounded-full text-sm font-bold text-[#d4af37] border-2 border-[#d4af37]'>
                                    Total:{' '}
                                    {gameState.players.player2.split1[0]
                                      .total ?? 0}
                                  </div>
                                </div>

                                {/* Split1 Hand Action Buttons for Player 2 */}
                                <div className='flex justify-center gap-2 flex-wrap mt-8'>
                                  {isHandSelected(gameState, 'player2', 0, 1) &&
                                    gameState?.current_player === 'player2' &&
                                    gameState.players.player2.split1[0]?.cards
                                      ?.length === 2 &&
                                    canSplit(
                                      gameState.players.player2.split1[0].cards
                                    ) &&
                                    gameState.players.player2.split1[0]
                                      .status === 'playing' && (
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'split_player_auto',
                                            player_id: 'player2'
                                          })
                                        }
                                        className='px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors'
                                      >
                                        Split
                                      </button>
                                    )}

                                  {isHandSelected(gameState, 'player2', 0, 1) &&
                                    gameState?.current_player === 'player2' && (
                                      <>
                                        {gameState?.dealer?.cards?.[0]?.[0] ===
                                          'A' &&
                                          !insuranceState[`player2_0_1`] &&
                                          !gameState.players.player2.split1[0]
                                            .insurence && (
                                            <button
                                              onClick={() =>
                                                handleInsurance('player2', 0, 1)
                                              }
                                              className='px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors'
                                            >
                                              Insurance
                                            </button>
                                          )}
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'hit_player',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              1
                                            )
                                          }}
                                          className='px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
                                        >
                                          Hit
                                        </button>
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'double_player',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              1
                                            )
                                          }}
                                          className='px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors'
                                        >
                                          Double
                                        </button>
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'next_turn',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              1
                                            )
                                          }}
                                          className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
                                        >
                                          Stand
                                        </button>
                                      </>
                                    )}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Split2 Hand (auto mode: show if cards exist) */}
                        {gameState.mode !== 'manual' &&
                          gameState.players.player2.split2[0]?.cards?.length >
                            0 && (
                            <div className='mt-4'>
                              <div
                                className={`rounded-xl p-4 relative ${getHandBoxColor(
                                  isHandSelected(gameState, 'player2', 0, 2) &&
                                    gameState?.current_player === 'player2',
                                  gameState.players.player2.status === 1,
                                  gameState.players.player2.split2[0]?.result
                                )}`}
                              >
                                <div className='text-center mb-3'>
                                  <div
                                    className={`text-lg font-medium ${
                                      isHandSelected(gameState, 'player2', 0, 2)
                                        ? 'text-gray-900'
                                        : 'text-white'
                                    }`}
                                  >
                                    Split Hand 2
                                  </div>
                                </div>

                                <div className='flex justify-center items-center gap-4 mb-4'>
                                  {gameState.players.player2.split2[0].cards.map(
                                    (card, index) => (
                                      <div
                                        key={index}
                                        className='relative w-16 h-24 transform hover:scale-110 transition-transform duration-200 group'
                                      >
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
                                  {[
                                    ...Array(
                                      Math.max(
                                        0,
                                        2 -
                                          (gameState.players.player2.split2[0]
                                            .cards.length ?? 0)
                                      )
                                    )
                                  ].map((_, index) => (
                                    <div
                                      key={`empty-${index}`}
                                      className='w-16 h-24 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center bg-gray-800/50'
                                    />
                                  ))}
                                </div>

                                <div className='absolute top-[93%] left-[43%] text-center'>
                                  <div className='inline-block bg-[#911606] px-3 py-1 rounded-full text-sm font-bold text-[#d4af37] border-2 border-[#d4af37]'>
                                    Total:{' '}
                                    {gameState.players.player2.split2[0]
                                      .total ?? 0}
                                  </div>
                                </div>

                                {/* Split2 Hand Action Buttons for Player 2 */}
                                <div className='flex justify-center gap-2 flex-wrap mt-8'>
                                  {isHandSelected(gameState, 'player2', 0, 2) &&
                                    gameState?.current_player === 'player2' &&
                                    gameState.players.player2.split2[0]?.cards
                                      ?.length === 2 &&
                                    canSplit(
                                      gameState.players.player2.split2[0].cards
                                    ) &&
                                    gameState.players.player2.split2[0]
                                      .status === 'playing' && (
                                      <button
                                        onClick={() =>
                                          sendWebSocketMessage({
                                            action: 'split_player_auto',
                                            player_id: 'player2'
                                          })
                                        }
                                        className='px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors'
                                      >
                                        Split
                                      </button>
                                    )}

                                  {isHandSelected(gameState, 'player2', 0, 2) &&
                                    gameState?.current_player === 'player2' && (
                                      <>
                                        {gameState?.dealer?.cards?.[0]?.[0] ===
                                          'A' &&
                                          !insuranceState[`player2_0_2`] &&
                                          !gameState.players.player2.split2[0]
                                            .insurence && (
                                            <button
                                              onClick={() =>
                                                handleInsurance('player2', 0, 2)
                                              }
                                              className='px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors'
                                            >
                                              Insurance
                                            </button>
                                          )}
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'hit_player',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              2
                                            )
                                          }}
                                          className='px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors'
                                        >
                                          Hit
                                        </button>
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'double_player',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              2
                                            )
                                          }}
                                          className='px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors'
                                        >
                                          Double
                                        </button>
                                        <button
                                          onClick={() => {
                                            sendWebSocketMessage({
                                              action: 'next_turn',
                                              player_id: 'player2',
                                              hand_index: 0
                                            })
                                            clearInsuranceForHand(
                                              'player2',
                                              0,
                                              2
                                            )
                                          }}
                                          className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
                                        >
                                          Stand
                                        </button>
                                      </>
                                    )}
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Next Button */}
                    {gameState.players.player2.status === 1 &&
                      gameState?.current_turn === 'player' && (
                        <div className='mt-6 flex justify-end'>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleNextTurn()
                            }}
                            className='px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center space-x-2 text-base'
                          >
                            <svg
                              className='w-5 h-5'
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
                            <span>Next Turn</span>
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
          {/* Enhanced Popup Message */}
          {showPopup && (
            <div className='fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-bounce'>
              <div className='bg-gradient-to-r from-red-800 to-red-700 border border-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-xl'>
                <div className='w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse'></div>
                <span className='font-medium text-lg'>{popupMessage}</span>
              </div>
            </div>
          )}

          {/* Result Popup */}
          {showResultPopup && (
            <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
              <div className='bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 text-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 backdrop-blur-xl'>
                <div className='text-center'>
                  {/* Big emojis for each hand in a single row */}
                  <div className='flex justify-center items-center gap-4 text-6xl mb-4'>
                    {(() => {
                      const player2Data = gameState?.players?.player2
                      if (!player2Data) return null
                      const handResults = [
                        player2Data.hands?.[0]?.result,
                        player2Data.split1?.[0]?.result,
                        player2Data.split2?.[0]?.result
                      ]
                      const emoji = (result: string) =>
                        result === 'win'
                          ? '🏆'
                          : result === 'fail' || result === 'lose'
                          ? '😔'
                          : result === 'tie'
                          ? '🤝'
                          : null
                      return handResults.map((result, i) =>
                        result ? <span key={i}>{emoji(result)}</span> : null
                      )
                    })()}
                  </div>
                  <h2 className='text-3xl font-bold mb-4'>
                    {playerResult === 'win' && 'YOU WIN!'}
                    {playerResult === 'lose' && 'YOU LOSE'}
                    {playerResult === 'tie' && "IT'S A TIE"}
                  </h2>
                  <div className='mb-4 space-y-2 text-lg'>
                    {/* Per-hand results */}
                    {(() => {
                      const player2Data = gameState?.players?.player2
                      if (!player2Data) return null
                      const handResults = [
                        {
                          label: 'Main hand',
                          result: player2Data.hands?.[0]?.result
                        },
                        {
                          label: 'Split 1',
                          result: player2Data.split1?.[0]?.result
                        },
                        {
                          label: 'Split 2',
                          result: player2Data.split2?.[0]?.result
                        }
                      ]
                      const emoji = (result: string) =>
                        result === 'win'
                          ? '🏆'
                          : result === 'fail' || result === 'lose'
                          ? '😔'
                          : result === 'tie'
                          ? '🤝'
                          : ''
                      const text = (result: string) =>
                        result === 'win'
                          ? 'won!'
                          : result === 'fail' || result === 'lose'
                          ? 'lost'
                          : result === 'tie'
                          ? 'tied'
                          : ''
                      return handResults.map((h, i) =>
                        h.result ? (
                          <div key={i}>
                            {h.label}: {text(h.result)} {emoji(h.result)}
                          </div>
                        ) : null
                      )
                    })()}
                  </div>

                  <button
                    onClick={() => setShowResultPopup(false)}
                    className='bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105'
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className='fixed inset-0 w-screen h-screen flex justify-center items-center z-50'>
          <video
            autoPlay
            loop
            muted
            className='absolute inset-0 w-full h-full object-cover'
          >
            <source src='/assets/ocean7vid.mp4' type='video/mp4' />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  )
}

export default GameMenu