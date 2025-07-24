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
}

const DealerNavbar = ({
  gameState,
  activatePlayer,
  deactivatePlayer,
  currentMode,
  betMenuOpen,
  setBetMenuOpen,
  gameMenuOpen,
  setGameMenuOpen
}: DealerNavbarProps) => {
  const router = useRouter()

  const handleModeChange = (mode: string) => {
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
            className='w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 relative flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden'
            aria-label='Open Bet/Table Menu'
            onClick={handleLogoClick}
          >
            <div className='relative w-12 h-12 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-16 lg:h-16'>
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
              Table: {gameState?.table_number || 'N/A'}
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
                  aria-label={`Toggle Player ${index + 1} - ${
                    isActive ? 'Active' : 'Inactive'
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
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${
                currentMode === 'live'
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
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${
                currentMode === 'auto' 
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
              className={`px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2 text-xs sm:text-sm md:text-base font-bold rounded-lg transition-all duration-200 hover:scale-105 ${
                currentMode === 'manual'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-yellow-400 text-black hover:bg-yellow-300'
              }`}
              aria-label='Switch to Manual Mode'
            >
              MANUAL
            </button>
          </div>

          <div
            className='w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 relative flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden'
            onClick={() => setGameMenuOpen?.(true)}
            aria-label='Open Game Menu'
          >
            Menu
          </div>
        </div>
      </div>
    </nav>
  )
}

export default DealerNavbar
