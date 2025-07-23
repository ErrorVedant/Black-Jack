"use client"
import { AnimatePresence } from 'framer-motion'

interface BetTableModalProps {
  betMenuOpen: boolean
  setBetMenuOpen: (open: boolean) => void
  pendingTableNumber: number
  setPendingTableNumber: (value: number) => void
  pendingMinBet: number
  setPendingMinBet: (value: number) => void
  pendingMaxBet: number
  setPendingMaxBet: (value: number) => void
  onSave?: () => void
}

const BetTableModal = ({
  betMenuOpen,
  setBetMenuOpen,
  pendingTableNumber,
  setPendingTableNumber,
  pendingMinBet,
  setPendingMinBet,
  pendingMaxBet,
  setPendingMaxBet,
  onSave
}: BetTableModalProps) => {
  const handleSave = () => {
    if (onSave) {
      onSave()
    }
    setBetMenuOpen(false)
  }

  return (
    <AnimatePresence>
      {betMenuOpen && (
        <div className='fixed top-0 left-0 h-full w-full z-50 flex items-center justify-center bg-black bg-opacity-60 overflow-y-auto p-4'>
          <div
            className='rounded-lg shadow-lg p-8 relative min-w-[320px] min-h-[200px] max-w-[90vw] my-8 flex flex-col items-center justify-center bg-[#F0DEAD]'
          >
            <button
              onClick={() => setBetMenuOpen(false)}
              className='absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none'
              aria-label='Close'
            >
              ×
            </button>
            <h2 className='text-xl font-bold text-[#741003] mb-6 text-center'>
              Table & Betting
            </h2>
            <div className='mb-4 w-full max-w-xs'>
              <label className='block text-[#741003] font-semibold mb-2'>
                Table Number
              </label>
              <input
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                value={pendingTableNumber}
                onChange={e =>
                  setPendingTableNumber(
                    e.target.value === ''
                      ? 0
                      : Number(e.target.value.replace(/\D/g, ''))
                  )
                }
                className='w-full bg-white border-2 border-[#741003] rounded-lg px-3 py-2 text-[#741003] appearance-none font-semibold moz-appearance-textfield'
                aria-label="Table Number"
                placeholder="Enter table number"
                title="Table Number"
              />
            </div>
            <div className='mb-4 w-full max-w-xs'>
              <label className='block text-[#741003] font-semibold mb-2'>
                Min Bet
              </label>
              <input
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                value={pendingMinBet}
                onChange={e =>
                  setPendingMinBet(
                    e.target.value === ''
                      ? 0
                      : Number(e.target.value.replace(/\D/g, ''))
                  )
                }
                className='w-full bg-white border-2 border-[#741003] rounded-lg px-3 py-2 text-[#741003] appearance-none font-semibold moz-appearance-textfield'
                aria-label="Minimum Bet"
                placeholder="Enter minimum bet"
                title="Minimum Bet"
              />
            </div>
            <div className='mb-6 w-full max-w-xs'>
              <label className='block text-[#741003] font-semibold mb-2'>
                Max Bet
              </label>
              <input
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                value={pendingMaxBet}
                onChange={e =>
                  setPendingMaxBet(
                    e.target.value === ''
                      ? 0
                      : Number(e.target.value.replace(/\D/g, ''))
                  )
                }
                className='w-full bg-white border-2 border-[#741003] rounded-lg px-3 py-2 text-[#741003] appearance-none font-semibold moz-appearance-textfield'
                aria-label="Maximum Bet"
                placeholder="Enter maximum bet"
                title="Maximum Bet"
              />
            </div>
            <button
              className='rounded-lg shadow text-xl font-bold text-white w-full max-w-xs h-[49px] bg-[#911606]'
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default BetTableModal