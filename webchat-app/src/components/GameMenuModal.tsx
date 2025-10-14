'use client'
import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface GameMenuModalProps {
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  currentMode?: string
  onModeChange?: (mode: string) => void
  // Add WebSocket functions
  sendWebSocketMessage?: (message: any) => void
  gameState?: any
  // Card selection state from parent
  selectedCard?: string | null
  setSelectedCard?: (card: string | null) => void
  selectedSuit?: string | null
  setSelectedSuit?: (suit: string | null) => void
  assignCard?: () => void
  // Popup functions
  setPopupMessage?: (message: string) => void
  setShowPopup?: (show: boolean) => void
}

export default function GameMenuModal ({
  menuOpen,
  setMenuOpen,
  currentMode = 'auto',
  onModeChange,
  sendWebSocketMessage,
  gameState,
  selectedCard,
  setSelectedCard,
  selectedSuit,
  setSelectedSuit,
  assignCard,
  setPopupMessage,
  setShowPopup
}: GameMenuModalProps) {
  const [localSelectedCard, setLocalSelectedCard] = useState<string | null>(
    null
  )
  const [localSelectedSuit, setLocalSelectedSuit] = useState<string | null>(
    null
  )
  const router = useRouter()

  // Use parent's card selection state if provided, otherwise use local state
  const currentSelectedCard =
    selectedCard !== undefined ? selectedCard : localSelectedCard
  const currentSetSelectedCard = setSelectedCard || setLocalSelectedCard
  const currentSelectedSuit =
    selectedSuit !== undefined ? selectedSuit : localSelectedSuit
  const currentSetSelectedSuit = setSelectedSuit || setLocalSelectedSuit

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
    { symbol: '♠', value: 'S', color: 'text-gray-800' },
    { symbol: '♥', value: 'H', color: 'text-red-500' },
    { symbol: '♦', value: 'D', color: 'text-red-500' },
    { symbol: '♣', value: 'C', color: 'text-gray-800' }
  ]

  const handleModeChange = (mode: string) => {
    // Call the onModeChange callback if provided (this will update currentMode)
    if (onModeChange) {
      onModeChange(mode)
    }

    // Navigate to the appropriate route without closing the modal
    switch (mode) {
      case 'live':
        router.push('/dealer')
        break
      case 'auto':
        router.push('/dealer/auto')
        break
      case 'manual':
        router.push('/dealer/manual')
        break
      default:
        break
    }
  }

  const handleWebSocketAction = (action: string, additionalData?: any) => {
    if (sendWebSocketMessage) {
      sendWebSocketMessage({ action, ...additionalData })
    } else {
      console.log(`Dummy action: ${action}`, additionalData)
    }
  }

  const handleManualAction = (actionName: string) => {
    if (sendWebSocketMessage) {
      switch (actionName) {
        case 'dealer_win':
          sendWebSocketMessage({
            action: 'manual_make_win',
            player_id: 'dealer'
          })
          break
        case 'dealer_lose':
          sendWebSocketMessage({
            action: 'manual_make_lose',
            player_id: 'dealer'
          })
          break
        default:
          if (actionName.includes('_win')) {
            const playerNum = actionName
              .replace('player', '')
              .replace('_win', '')
            sendWebSocketMessage({
              action: 'manual_make_win',
              player_id: `player${playerNum}`,
              split_level: 0,
              hand_index: 0
            })
          } else if (actionName.includes('_lose')) {
            const playerNum = actionName
              .replace('player', '')
              .replace('_lose', '')
            sendWebSocketMessage({
              action: 'manual_make_lose',
              player_id: `player${playerNum}`,
              split_level: 0,
              hand_index: 0
            })
          }
          break
      }
    } else {
      console.log(`Manual action: ${actionName}`)
    }
  }

  const handleAssignCard = () => {
    if (assignCard) {
      assignCard()
    } else if (
      sendWebSocketMessage &&
      currentSelectedCard &&
      currentSelectedSuit
    ) {
      const cardCode = currentSelectedCard + currentSelectedSuit
      if (gameState?.game_phase === 'dealer') {
        sendWebSocketMessage({
          action: 'hit_dealer',
          card: cardCode
        })
      } else if (gameState?.selected_hand?.player_id) {
        sendWebSocketMessage({
          action: 'hit_player',
          player_id: gameState.selected_hand.player_id,
          hand_index: gameState.selected_hand.hand_index,
          card: cardCode
        })
      }
      currentSetSelectedCard(null)
      currentSetSelectedSuit(null)
    }
  }

  const handlePullFromStack = () => {
    if (sendWebSocketMessage) {
      if (
        gameState?.current_turn === 'dealer' ||
        gameState?.game_phase === 'dealer'
      ) {
        sendWebSocketMessage({ action: 'hit_dealer' })
      } else if (gameState?.selected_hand?.player_id) {
        sendWebSocketMessage({
          action: 'hit_player',
          player_id: gameState.selected_hand.player_id,
          hand_index: gameState.selected_hand.hand_index
        })
      } else {
        if (setPopupMessage && setShowPopup) {
          setPopupMessage('⚠️ Please select a player or dealer first')
          setShowPopup(true)
          setTimeout(() => setShowPopup(false), 3000)
        }
      }
    }
  }

  return (
    <AnimatePresence>
      {menuOpen && (
        <div className='fixed top-0 left-0 h-full w-full z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto p-4'>
          <div
            className='rounded-lg shadow-lg p-8 relative min-w-[320px] min-h-[200px] max-w-[90vw] my-8 flex flex-col items-center justify-center'
            style={{ backgroundColor: '#F0DEAD' }}
          >
            <button
              onClick={() => setMenuOpen(false)}
              className='absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none'
              aria-label='Close'
            >
              ×
            </button>

            {/* Mode Selection Buttons */}
            <div className='flex flex-row items-center justify-center gap-6 w-full h-full'>
              <button
                className='px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors'
                style={{
                  width: 166,
                  height: 49,
                  backgroundColor:
                    currentMode === 'live' ? '#741003' : '#911606'
                }}
                onClick={() => handleModeChange('live')}
              >
                Live Mode
              </button>
              <button
                className='px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors whitespace-nowrap'
                style={{
                  height: 49,
                  backgroundColor:
                    currentMode === 'auto' ? '#741003' : '#911606'
                }}
                onClick={() => handleModeChange('auto')}
              >
                Automatic Mode
              </button>
              <button
                className='px-3 py-1.5 rounded-lg text-xl font-semibold shadow text-white transition-colors'
                style={{
                  width: 166,
                  height: 49,
                  backgroundColor:
                    currentMode === 'manual' ? '#741003' : '#911606'
                }}
                onClick={() => handleModeChange('manual')}
              >
                Manual Mode
              </button>
            </div>

            {/* Mode-specific content */}
            {currentMode === 'live' ? (
              <div className='flex flex-row w-full gap-6 justify-center items-center mt-8'>
                {/* Left Column - Game Actions */}
                <div className='flex-1 flex flex-col h-full min-h-full'>
                  <div className='flex flex-col items-center gap-2 mb-16'>
                    {/* <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('shuffle_deck')}
                    >
                      Shuffle Deck (52 Cards)
                    </button> */}
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reshuffle')}
                    >
                      Reshuffle
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('live_start')}
                    >
                      Live Start
                    </button>
                  </div>
                  <div className='flex flex-col items-center gap-2'>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('undo_last')}
                    >
                      Undo Last Action
                    </button>
                    {/* <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reset_game')}
                    >
                      Delete All Wins
                    </button> */}
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reset_round')}
                    >
                      Reset Hands
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#911606',
                        color: '#fff'
                      }}
                      onClick={() => handleWebSocketAction('reset_game')}
                    >
                      DELETE ALL WINS
                    </button>
                  </div>
                </div>

                {/* Right Column - Card Selection */}
                <div className='flex-1 flex flex-col h-full min-h-full'>
                  {/* Card Values Grid */}
                  <div className='grid grid-cols-3 grid-rows-4 gap-4 mb-10 place-items-center'>
                    <div />
                    <button
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                        currentSelectedCard === 'A'
                          ? 'bg-[#741003] text-white'
                          : 'bg-white text-[#741003]'
                      }`}
                      style={{ width: 80, height: 44 }}
                      onClick={() => currentSetSelectedCard('A')}
                    >
                      A
                    </button>
                    <div />
                    {[
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
                    ].map(rank => (
                      <button
                        key={`grid-btn-${rank}`}
                        className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                          currentSelectedCard === rank
                            ? 'bg-[#741003] text-white'
                            : 'bg-white text-[#741003]'
                        }`}
                        style={{ width: 80, height: 44 }}
                        onClick={() => currentSetSelectedCard(rank)}
                      >
                        {rank}
                      </button>
                    ))}
                  </div>

                  {/* Suits Grid */}
                  <div className='grid grid-cols-2 grid-rows-2 gap-4 mb-10 place-items-center'>
                    {suits.map(suit => (
                      <button
                        key={`suit-btn-${suit.value}`}
                        className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                          currentSelectedSuit === suit.value
                            ? 'bg-[#741003] text-white'
                            : 'bg-white text-[#741003]'
                        } ${suit.color}`}
                        style={{ width: 110, height: 44 }}
                        onClick={() => currentSetSelectedSuit(suit.value)}
                      >
                        {suit.symbol}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className='flex flex-row gap-4 items-center justify-center'>
                    <button
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                        currentSelectedCard && currentSelectedSuit
                          ? 'bg-[#D6AB5D] text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      style={{ width: 110, height: 44 }}
                      onClick={handleAssignCard}
                      disabled={!(currentSelectedCard && currentSelectedSuit)}
                    >
                      Deal Card
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[#911606] text-white'
                      style={{ width: 110, height: 44 }}
                      onClick={handlePullFromStack}
                    >
                      Pull Stack
                    </button>
                  </div>
                </div>
              </div>
            ) : currentMode === 'manual' ? (
              // <div className='flex flex-col items-center justify-center w-full h-full mt-8'>
              //   <div className='grid grid-cols-3 grid-rows-3 w-fit'>
              //     <div className='bg-[#D6AB5D] h-28 w-52 row-start-1 row-end-1 col-start-2 col-end-2 m-2 rounded-lg flex flex-col justify-center items-center'>
              //       <div className='text-lg font-bold mb-2 text-[#911606]'>
              //         DEALER
              //       </div>
              //       <div className='flex flex-row gap-2'>
              //         <button
              //           className='px-4 rounded text-[#741003] bg-[#F0DEAD]'
              //           onClick={() => handleManualAction('dealer_win')}
              //         >
              //           WIN
              //         </button>
              //         <button
              //           className='px-4 py-2 rounded bg-[#450A03] text-[#F0DEAD]'
              //           onClick={() => handleManualAction('dealer_lose')}
              //         >
              //           LOSE
              //         </button>
              //       </div>
              //     </div>
              //     {[1, 2, 3, 4, 5, 6].map(playerNum => (
              //       <div
              //         key={playerNum}
              //         className={`bg-[#911606] h-28 w-52 ${
              //           playerNum === 1 || playerNum === 4
              //             ? 'row-start-2 row-end-2 col-start-1 col-end-1'
              //             : playerNum === 2 || playerNum === 5
              //             ? 'row-start-2 row-end-2 col-start-2 col-end-2'
              //             : 'row-start-2 row-end-2 col-start-3 col-end-3'
              //         } ${
              //           playerNum > 3 ? 'row-start-3 row-end-3' : ''
              //         } m-2 rounded-lg flex flex-col justify-center items-center`}
              //       >
              //         <div className='text-lg font-bold mb-2 text-[#F0DEAD]'>
              //           PLAYER {playerNum}
              //         </div>
              //         <div className='flex flex-row gap-2'>
              //           <button
              //             className='px-4 rounded text-[#741003] bg-[#F0DEAD]'
              //             onClick={() => handleManualAction(`player${playerNum}_win`)}
              //           >
              //             WIN
              //           </button>
              //           <button
              //             className='px-4 py-2 rounded bg-[#450A03] text-[#F0DEAD]'
              //             onClick={() => handleManualAction(`player${playerNum}_lose`)}
              //           >
              //             LOSE
              //           </button>
              //         </div>
              //       </div>
              //     ))}
              //   </div>
              // </div>
              <div className='flex flex-col items-center justify-center w-full h-full'>
                {/* <button
                  onClick={() => handleWebSocketAction('shuffle_deck')}
                  className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
                >
                  🔄 Shuffle Deck (52 cards)
                </button> */}
                <button
                  className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
                  onClick={() => handleWebSocketAction('manual_start')}
                >
                  Start Manual
                </button>
                <button
                  className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
                  onClick={() => handleWebSocketAction('reset_round ')}
                >
                  NEW GAME
                </button>
                <button
                  className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                  style={{
                    width: 250,
                    height: 49,
                    backgroundColor: '#911606',
                    color: '#fff'
                  }}
                  onClick={() => handleWebSocketAction('reset_game')}
                >
                  DELETE ALL WINS
                </button>
              </div>
            ) : (
              /* Auto Mode */
              // <div className='flex flex-col items-center justify-center w-full h-full'>
              //   <button
              //     onClick={() => handleWebSocketAction('shuffle_deck')}
              //     className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
              //   >
              //     🔄 Shuffle Deck (52 cards)
              //   </button>
              //   <button
              //     className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
              //     onClick={() => handleWebSocketAction('distribute_cards')}
              //   >
              //     Distribute Cards
              //   </button>
              //   <button
              //     className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
              //     onClick={() => handleWebSocketAction('reset_round ')}
              //   >
              //     NEW GAME
              //   </button>
              //   <button
              //     className='m-4 px-5 py-3 rounded-lg text-xl font-bold shadow text-white bg-[#911606] hover:bg-[#741003] transition-colors'
              //     onClick={() => handleWebSocketAction('reshuffle')}
              //   >
              //     Reshuffle
              //   </button>
              // </div>
              <div className='flex flex-row w-full gap-6 justify-center items-center mt-8'>
                {/* Left Column - Game Actions */}
                <div className='flex-1 flex flex-col h-full min-h-full'>
                  <div className='flex flex-col items-center gap-2 mb-16'>
                    {/* <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('shuffle_deck')}
                    >
                      Shuffle Deck (52 Cards)
                    </button> */}
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reshuffle')}
                    >
                      Reshuffle
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('distribute_cards')}
                    >
                      Distribute Cards
                    </button>
                  </div>
                  <div className='flex flex-col items-center gap-2'>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('undo_last')}
                    >
                      Undo Last Action
                    </button>
                    {/* <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reset_game')}
                    >
                      Delete All Wins
                    </button> */}
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#fff',
                        color: '#741003'
                      }}
                      onClick={() => handleWebSocketAction('reset_round')}
                    >
                      Reset Hands
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center'
                      style={{
                        width: 250,
                        height: 49,
                        backgroundColor: '#911606',
                        color: '#fff'
                      }}
                      onClick={() => handleWebSocketAction('reset_game')}
                    >
                      DELETE ALL WINS
                    </button>
                  </div>
                </div>

                {/* Right Column - Card Selection */}
                <div className='flex-1 flex flex-col h-full min-h-full'>
                  {/* Card Values Grid */}
                  <div className='grid grid-cols-3 grid-rows-4 gap-4 mb-10 place-items-center'>
                    <div />
                    <button
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                        currentSelectedCard === 'A'
                          ? 'bg-[#741003] text-white'
                          : 'bg-white text-[#741003]'
                      }`}
                      style={{ width: 80, height: 44 }}
                      onClick={() => currentSetSelectedCard('A')}
                    >
                      A
                    </button>
                    <div />
                    {[
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
                    ].map(rank => (
                      <button
                        key={`grid-btn-${rank}`}
                        className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                          currentSelectedCard === rank
                            ? 'bg-[#741003] text-white'
                            : 'bg-white text-[#741003]'
                        }`}
                        style={{ width: 80, height: 44 }}
                        onClick={() => currentSetSelectedCard(rank)}
                      >
                        {rank}
                      </button>
                    ))}
                  </div>

                  {/* Suits Grid */}
                  <div className='grid grid-cols-2 grid-rows-2 gap-4 mb-10 place-items-center'>
                    {suits.map(suit => (
                      <button
                        key={`suit-btn-${suit.value}`}
                        className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                          currentSelectedSuit === suit.value
                            ? 'bg-[#741003] text-white'
                            : 'bg-white text-[#741003]'
                        } ${suit.color}`}
                        style={{ width: 110, height: 44 }}
                        onClick={() => currentSetSelectedSuit(suit.value)}
                      >
                        {suit.symbol}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className='flex flex-row gap-4 items-center justify-center'>
                    <button
                      className={`rounded-lg shadow text-xl font-bold flex items-center justify-center ${
                        currentSelectedCard && currentSelectedSuit
                          ? 'bg-[#D6AB5D] text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      style={{ width: 110, height: 44 }}
                      onClick={handleAssignCard}
                      disabled={!(currentSelectedCard && currentSelectedSuit)}
                    >
                      Deal Card
                    </button>
                    <button
                      className='rounded-lg shadow text-xl font-bold flex items-center justify-center bg-[#911606] text-white'
                      style={{ width: 110, height: 44 }}
                      onClick={handlePullFromStack}
                    >
                      Pull Stack
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
