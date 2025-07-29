'use client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface GameState {
  table_number?: number
  players?: {
    [key: string]: {
      status: number
    }
  }
  min_bet?: number
  max_bet?: number
}

interface DealerNavbarProps {
  gameState?: GameState | null
  activatePlayer?: (playerId: string) => void
  deactivatePlayer?: (playerId: string) => void
  currentMode?: 'live' | 'auto' | 'manual'
  betMenuOpen?: boolean
  setBetMenuOpen?: (open: boolean) => void
  gameMenuOpen?: boolean
  setGameMenuOpen?: (open: boolean) => void
  sendWebSocketMessage?: (message: any) => void
}

const DealerNavbar = ({
  gameState,
  activatePlayer,
  deactivatePlayer,
  currentMode,
  betMenuOpen,
  setBetMenuOpen,
  gameMenuOpen,
  setGameMenuOpen,
  sendWebSocketMessage
}: DealerNavbarProps) => {
  const router = useRouter()

  const handleModeChange = (mode: string) => {
    // Navigate first
    switch (mode) {
      case 'live':
        // if (sendWebSocketMessage) {
        //   sendWebSocketMessage({
        //     action: 'set_game_mode',
        //     mode: 'live'
        //   })
        //   console.log('Sending set_game_mode to backend (after navigation)')
        // }
        router.push('/dealer')
        break
      case 'auto':
        // if (sendWebSocketMessage) {
        //   sendWebSocketMessage({
        //     action: 'set_game_mode',
        //     mode: 'auto'
        //   })
        //   console.log('Sending set_game_mode to backend (after navigation)')
        // }
        router.push('/dealer/auto')
        break
      case 'manual':
        // if (sendWebSocketMessage) {
        //   sendWebSocketMessage({
        //     action: 'set_game_mode',
        //     mode: 'manual'
        //   })
        //   console.log('Sending set_game_mode to backend (after navigation)')
        // }
        router.push('/dealer/manual')
        break
      default:
        router.push('/dealer')
    }
  }

  const handleLogoClick = () => {
    if (setBetMenuOpen) {
      setBetMenuOpen(!betMenuOpen)
    }
  }

  return (
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
            className='w-24 h-16 sm:w-28 sm:h-16 md:w-32 md:h-20 lg:w-40 lg:h-24 relative flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden'
            aria-label='Open Bet/Table Menu'
            onClick={handleLogoClick}
          >
            <div className='relative w-full h-full'>
              <Image
                src='/assets/logo.png'
                alt='Casino Wars Logo'
                fill
                className='object-contain'
                sizes='(max-width: 640px) 96px, (max-width: 768px) 112px, (max-width: 1024px) 128px, (max-width: 1280px) 160px, 160px'
                priority
              />
            </div>
          </div>
          <div className='flex flex-col items-start border-l-4 border-r-4 border-yellow-300 px-2'>
            <span className='text-yellow-300 text-xs sm:text-sm lg:text-base mt-0'>
              Table: {gameState?.table_number || 'N/A'}
            </span>
            <span className='text-yellow-300 text-xs sm:text-sm lg:text-base mt-1'>
              Min Bet: {gameState?.min_bet ?? 'N/A'}
            </span>
            <span className='text-yellow-300 text-xs sm:text-sm lg:text-base mt-1'>
              Max Bet: {gameState?.max_bet ?? 'N/A'}
            </span>
          </div>

          {/* Center Hats - Optimized for 1112x800 */}
          <div className='flex items-center justify-center gap-1 sm:gap-2 md:gap-3 lg:gap-4'>
            {/* Generate 6 hat slots for players */}
            {Array.from({ length: 6 }, (_, index) => {
              const playerId = `player${index + 1}`
              const playerData = gameState?.players?.[playerId]
              const isActive = playerData?.status === 1

              return (
                <div
                  key={playerId}
                  className='relative w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 cursor-pointer hover:scale-110 transition-transform duration-200'
                  onClick={e => {
                    e.stopPropagation()
                    if (activatePlayer && deactivatePlayer) {
                      if (isActive) {
                        deactivatePlayer(playerId)
                      } else {
                        activatePlayer(playerId)
                      }
                    }
                  }}
                  aria-label={`Toggle Player ${index + 1} - ${isActive ? 'Active' : 'Inactive'
                    }`}
                >
                  <Image
                    src={
                      isActive ? '/assets/whitehat.png' : '/assets/redhat.png'
                    }
                    alt={`Player ${index + 1} Hat`}
                    fill
                    className='object-contain drop-shadow-lg'
                    sizes='(max-width: 640px) 24px, (max-width: 768px) 32px, (max-width: 1024px) 40px, (max-width: 1280px) 48px, 48px'
                    priority
                  />
                </div>
              )
            })}
          </div>

          {/* Right Mode Buttons */}
          <div className='flex items-center gap-1 sm:gap-2 md:gap-3'>
            {/* Live Mode Button */}
            <button
              onClick={() => handleModeChange('live')}
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${currentMode === 'live'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-yellow-400 text-black hover:bg-yellow-300'
                }`}
              aria-label='Switch to Live Mode'
            >
              LIVE
            </button>

            {/* Auto Mode Button */}
            <button
              onClick={() => handleModeChange('auto')}
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${currentMode === 'auto'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-yellow-400 text-black hover:bg-yellow-300'
                }`}
              aria-label='Switch to Auto Mode'
            >
              AUTO
            </button>

            {/* Manual Mode Button */}
            <button
              onClick={() => handleModeChange('manual')}
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${currentMode === 'manual'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-yellow-400 text-black hover:bg-yellow-300'
                }`}
              aria-label='Switch to Manual Mode'
            >
              MANUAL
            </button>
          </div>

          <div
            className='w-24 h-16 sm:w-28 sm:h-16 md:w-32 md:h-20 lg:w-40 lg:h-24 relative flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden'
            onClick={() => setGameMenuOpen?.(true)}
            aria-label='Open Game Menu'
          >
            <div className='relative w-full h-full'>
              <Image
                src='/assets/menu.png'
                alt='Menu'
                fill
                className='object-contain'
                sizes='(max-width: 640px) 96px, (max-width: 768px) 112px, (max-width: 1024px) 128px, (max-width: 1280px) 160px, 160px'
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default DealerNavbar
