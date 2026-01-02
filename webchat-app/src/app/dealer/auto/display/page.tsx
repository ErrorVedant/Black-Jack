"use client";

import React, { useState, useEffect } from "react";
import { getWebSocketUrl } from "@/lib/ip-config";

interface Hand {
  cards: string[];
  total: number;
  status: string;
  result?: string;
  bet?: number;
  insurence?: number;
}

interface PlayerData {
  status: number;
  hands: Hand[];
  split1: Hand[];
  split1_status: number;
  split2: Hand[];
  split2_status: number;
  insurence?: number;
}

interface Players {
  [key: string]: PlayerData;
}

interface GameState {
  deck_count: number;
  round_number: number;
  rounds_played_in_game: number;
  dealer: {
    cards: string[];
    total: number;
    status: string;
  };
  players: Players;
  game_phase: string;
  table_number: number;
  current_turn: string;
  selected_hand?: {
    player_id: string;
    hand_index: number;
    split_level: number;
  };
  current_player?: string;
  evaluate_game: boolean;
  mode: string;
  games_played?: number;
  max_bet?: number;
  min_bet?: number;
}

const playerGrid = [
  // [playerId, gridClass]
  [
    "player1",
    "col-start-2 col-end-4 row-start-2 row-end-4 flex items-center justify-center z-10",
  ],
  [
    "player2",
    "col-start-3 col-end-4 row-start-4 row-end-7 flex items-center justify-center z-10 mb-16",
  ],
  [
    "player3",
    "col-start-4 col-end-5 row-start-6 row-end-8 flex items-center justify-center z-10",
  ],
  [
    "player4",
    "col-start-6 col-end-7 row-start-6 row-end-8 flex items-center justify-center z-10",
  ],
  [
    "player5",
    "col-start-7 col-end-8 row-start-4 row-end-7 flex items-center justify-center z-10 mb-16",
  ],
  [
    "player6",
    "col-start-7 col-end-9 row-start-2 row-end-4 flex items-center justify-center z-10",
  ],
];

function getPlayerState(
  player: PlayerData
): "inactive" | "won" | "lost" | "active" | "bust" | "playing" | "tie" {
  if (!player || player.status !== 1) return "inactive";

  // Check main hand result
  const mainResult = player.hands?.[0]?.result;
  const split1Result = player.split1?.[0]?.result;
  const split2Result = player.split2?.[0]?.result;

  // If any hand won, show won
  if (mainResult === "win" || split1Result === "win" || split2Result === "win")
    return "won";

  // If any hand tied, show tie (but only if no wins)
  if (mainResult === "tie" || split1Result === "tie" || split2Result === "tie")
    return "tie";

  // If all active hands lost, show lost
  const activeHands = [
    player.hands?.[0],
    ...(player.split1_status === 1 ? [player.split1?.[0]] : []),
    ...(player.split2_status === 1 ? [player.split2?.[0]] : []),
  ].filter(Boolean);

  if (
    activeHands.length > 0 &&
    activeHands.every((hand) => hand?.result === "fail")
  )
    return "lost";

  // Check for bust
  const mainTotal = player.hands?.[0]?.total || 0;
  if (mainTotal > 21) return "bust";

  // If game is in progress
  if (player.hands?.[0]?.status === "playing") return "playing";

  return "active";
}

const stateToImg: Record<string, string> = {
  inactive: "/assets/black.png",
  won: "/assets/green.png",
  lost: "/assets/red.png",
  active: "/assets/purple.png",
  bust: "/assets/red.png",
  playing: "/assets/brown.png",
  tie: "/assets/purple.png",
};

const stateToOverlay: Partial<Record<string, string>> = {
  won: "WON",
  lost: "LOST",
  bust: "BUST",
  active: "ACTIVE",
  playing: "PLAY",
  tie: "TIE",
};

// BlackJack Hand Display Component
const BlackJackHand = ({
  playerId,
  player,
  isDealer = false,
  showDealerHole = false,
}: {
  playerId: string;
  player: PlayerData | any;
  isDealer?: boolean;
  showDealerHole?: boolean;
}) => {
  if (isDealer) {
    const cards = player?.cards || [];
    const total = player?.total || 0;

    return (
      <div className="flex flex-col items-center space-y-1">
        {/* <div className='text-yellow-500 text-5xl font-bold'>DEALER</div> */}
        <div className="relative flex">
          {cards.map((card: string, index: number) => (
            <div
              key={index}
              className="w-36 h-52 relative"
              style={{
                marginLeft: index > 0 ? "-110px" : "0",
                zIndex: index,
              }}
            >
              <img
                src={
                  showDealerHole || index === 0
                    ? `/cards/${card}.png`
                    : "/cards/back.png"
                }
                alt={showDealerHole || index === 0 ? card : "Hidden"}
                className="w-full h-full object-contain scale-110"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/cards/back.png";
                }}
              />
            </div>
          ))}
        </div>
        {showDealerHole && (
          <div className="text-yellow-500 text-sm font-semibold">
            Total: {total}
          </div>
        )}
      </div>
    );
  }

  if (!player || player.status !== 1) {
    return (
      <div className="flex flex-col items-center space-y-2 opacity-50">
        <div className="text-gray-400 text-sm">{playerId.toUpperCase()}</div>
        <div className="text-gray-400 text-xs">INACTIVE</div>
      </div>
    );
  }

  const mainHand = player.hands?.[0];
  const split1Hand = player.split1_status === 1 ? player.split1?.[0] : null;
  const split2Hand = player.split2_status === 1 ? player.split2?.[0] : null;

  // Calculate how many hands are active to determine card sizing
  const activeHands = [mainHand, split1Hand, split2Hand].filter(Boolean);
  const handCount = activeHands.length;

  // Dynamic card sizing and overlap based on number of active hands
  let cardSize = "w-36 h-44"; // Default size for single hand
  let overlapAmount = "-120px"; // Default overlap

  if (handCount === 3) {
    cardSize = "w-32 h-48";
    overlapAmount = "-100px";
  }

  return (
    <div className="flex items-center justify-center relative overflow-visible">
      <div className="flex gap-2">
        {/* Main Hand */}
        {mainHand && (
          <div className="flex flex-col items-center space-y-1">
            {/* <div className='text-yellow-500 text-xs font-bold'>MAIN</div> */}
            <div className="relative flex">
              {mainHand.cards?.map((card: string, index: number) => (
                <div
                  key={`main-${index}`}
                  className={`${cardSize} relative`}
                  style={{
                    marginLeft: index > 0 ? overlapAmount : "0",
                    zIndex: index,
                  }}
                >
                  <img
                    src={`/cards/${card}.png`}
                    alt={card}
                    className="w-full h-full object-contain scale-105 mt-1"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/cards/back.png";
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="text-yellow-500 text-xl pt-0.5">
              {mainHand.total || 0}
            </div>
          </div>
        )}

        {/* Split1 Hand */}
        {split1Hand && (
          <div className="flex flex-col items-center space-y-1">
            <div className="text-yellow-500 text-xs font-bold">S1</div>
            <div className="relative flex">
              {split1Hand.cards?.map((card: string, index: number) => (
                <div
                  key={`split1-${index}`}
                  className={`${cardSize} relative`}
                  style={{
                    marginLeft: index > 0 ? overlapAmount : "0",
                    zIndex: index,
                  }}
                >
                  <img
                    src={`/cards/${card}.png`}
                    alt={card}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/cards/back.png";
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="text-yellow-500 text-xs">
              {split1Hand.total || 0}
            </div>
          </div>
        )}

        {/* Split2 Hand */}
        {split2Hand && (
          <div className="flex flex-col items-center space-y-1">
            <div className="text-yellow-500 text-xs font-bold">S2</div>
            <div className="relative flex">
              {split2Hand.cards?.map((card: string, index: number) => (
                <div
                  key={`split2-${index}`}
                  className={`${cardSize} relative`}
                  style={{
                    marginLeft: index > 0 ? overlapAmount : "0",
                    zIndex: index,
                  }}
                >
                  <img
                    src={`/cards/${card}.png`}
                    alt={card}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/cards/back.png";
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="text-yellow-500 text-xs">
              {split2Hand.total || 0}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DisplayPage = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showDealerCards, setShowDealerCards] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    const connect = async () => {
      const wsUrl = await getWebSocketUrl(6790);
      ws = new WebSocket(wsUrl);


      ws.onopen = () => {
        console.log("Display connected to server");
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      ws.onclose = () => {
        console.log("Display disconnected from server");
        setIsConnected(false);

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
          );
          reconnectTimeout = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Display received:", data);

        if (data.game_state) {
          setGameState(data.game_state);
        }

        switch (data.action) {
          case "game_started":
            setShowDealerCards(false);
            break;
          case "game_evaluated":
          case "round_finished":
            setShowDealerCards(true);
            break;
          case "game_reset":
          case "round_reset":
            setShowDealerCards(false);
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

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#D6AB5D] flex items-center justify-center">
        <div className="text-4xl text-white">
          {isConnected ? "Waiting for game data..." : "Connecting to server..."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D6AB5D] flex flex-col items-center justify-center">
      <div className="h-[94vh] w-[96vw] m-3 bg-[#971909] flex flex-col">
        <nav className="w-full h-[15vh] relative flex items-center justify-between px-8">
          <img
            src="/assets/wood.png"
            alt="Wood Background"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Left Button */}
          <div className="relative top-4 flex items-center justify-center z-10">
            <div className="text-5xl text-yellow-500">Table:&nbsp;</div>
            <div className="text-5xl text-yellow-500">
              {gameState.table_number}
            </div>
          </div>

          {/* Center Image - unchanged */}
          <img
            src="/assets/blackjack_logo.png"
            alt="BlackJack Logo"
            className="relative z-10 h-[12vh] object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/assets/logo.png";
            }}
          />

          {/* Right Button */}
          <div className="flex flex-col items-center justify-center z-10">
            <h1 className="text-yellow-500 text-5xl font-bold">Bets</h1>
            <span className="text-yellow-300 text-2xl mt-1">
              Min: {gameState?.min_bet ?? "N/A"}
            </span>
            <span className="text-yellow-300 text-2xl mt-1">
              Max: {gameState?.max_bet ?? "N/A"}
            </span>
          </div>
        </nav>

        <div className="flex-1 grid grid-cols-9 grid-rows-9 w-[96vw] h-[79vh]">
          {/* Side Designs */}
          <div className="col-start-1 col-end-2 row-start-2 row-end-8 flex items-center justify-center z-10">
            <img
              src="/assets/side_design.png"
              alt="Side Design"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="col-start-9 col-end-10 row-start-2 row-end-8 flex items-center justify-center z-10">
            <img
              src="/assets/side_design.png"
              alt="Side Design"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Table Background */}
          <div className="col-start-3 col-end-8 row-start-1 row-end-6 flex items-center justify-center z-10">
            <img
              src="/assets/center_piece-Photoroom.png"
              alt="Table Background"
              className="w-full h-full object-contain mt-4"
            />
          </div>

          {/* Dealer Area */}
          <div className="col-start-4 col-end-7 row-start-3 row-end-6 flex justify-center items-center relative z-10">
            <BlackJackHand
              playerId="dealer"
              player={gameState.dealer}
              isDealer={true}
              showDealerHole={
                showDealerCards ||
                gameState.game_phase === "dealer" ||
                gameState.game_phase === "finished"
              }
            />
          </div>

          {/* Players - Left side (1-3) - now mapped to players 6, 5, 4 */}
          {playerGrid.slice(0, 3).map(([currentPlayerId, gridClass], idx) => {
            // Remap playerId: player1 -> player6, player2 -> player5, player3 -> player4
            const playerId = `player${6 - idx}`;
            const player = gameState.players?.[playerId];
            const state = getPlayerState(player);
            const imgSrc = stateToImg[state];
            const overlay = stateToOverlay[state];

            return (
              <div key={currentPlayerId} className={gridClass}>
                <div className='w-[17vw] h-[17vh] flex flex-row items-center relative'>
                  {/* Cards container - positioned absolutely to the left of player image */}
                  <div className='absolute right-[8vw] top-1/2 -translate-y-1/2 flex justify-end pr-4'>
                    <BlackJackHand playerId={playerId} player={player} />
                  </div>

                  {/* Player image - fixed position on the right */}
                  <div className='absolute right-0 top-1/2 -translate-y-1/2 w-[8vw] h-[14vh] flex items-center justify-center'>
                    <img
                      src={imgSrc}
                      alt='Player State'
                      className='w-full h-full object-contain'
                    />
                    <div className='absolute inset-0 flex items-center justify-center text-white text-lg'>
                      <div className='flex flex-col items-center'>
                        <div className='font-bold text-3xl'>{6 - idx}</div>
                        <div className='text-2xl'>{overlay}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Players - Right side (4-6) - now mapped to players 3, 2, 1 */}
          {playerGrid.slice(3).map(([currentPlayerId, gridClass], idx) => {
            // Remap playerId: player4 -> player3, player5 -> player2, player6 -> player1
            const playerId = `player${3 - idx}`;
            const player = gameState.players?.[playerId];
            const state = getPlayerState(player);
            const imgSrc = stateToImg[state];
            const overlay = stateToOverlay[state];

            return (
              <div key={currentPlayerId} className={gridClass}>
                <div className='w-[17vw] h-[17vh] flex flex-row items-center relative'>
                  {/* Player image - fixed position on the left */}
                  <div className='absolute left-0 top-1/2 -translate-y-1/2 w-[8vw] h-[14vh] flex items-center justify-center'>
                    <img
                      src={imgSrc}
                      alt='Player State'
                      className='w-full h-full object-contain'
                    />
                    <div className='absolute inset-0 flex items-center justify-center text-white text-lg'>
                      <div className='flex flex-col items-center'>
                        <div className='font-bold text-3xl'>{3 - idx}</div>
                        <div className='text-2xl'>{overlay}</div>
                      </div>
                    </div>
                  </div>

                  {/* Cards container - positioned absolutely to the right of player image */}
                  <div className='absolute left-[8vw] top-1/2 -translate-y-1/2 flex justify-start pl-4'>
                    <BlackJackHand playerId={playerId} player={player} />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Center Logo/Game Info */}
          <div className="col-start-5 col-end-6 row-start-1 row-end-3 flex flex-col items-center justify-center z-10">
            <img
              src="/assets/ocean7.png"
              alt="Ocean7 Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Footer Stats */}
          <footer className="col-start-1 col-end-10 row-start-8 row-end-10 flex justify-start items-center relative">
            <img
              src="/assets/wood.png"
              alt="Wood Background"
              className="absolute inset-0 w-full h-full object-cover rotate-180 z-0"
            />
            <div className="relative top-4 flex items-center justify-center z-10 mx-8">
              <div className="text-5xl text-yellow-500">Games:&nbsp;</div>
              <div className="text-5xl text-yellow-500">
                {gameState.rounds_played_in_game ?? 0}
              </div>
            </div>
            {/* <div className='relative top-4 flex items-center justify-center z-10'>
              <div className='text-3xl text-yellow-500'>Phase:&nbsp;</div>
              <div className='text-2xl text-yellow-500'>
                {gameState.game_phase?.toUpperCase() || 'WAITING'}
              </div>
            </div> */}
            {/* <div className='relative top-4 flex items-center justify-center z-10'>
              <div className='text-3xl text-yellow-500'>Table:&nbsp;</div>
              <div className='text-2xl text-yellow-500'>
                {gameState.table_number}
              </div>
            </div> */}
            {/* <div className='relative top-4 flex items-center justify-center z-10'>
              <div className='text-3xl text-yellow-500'>Mode:&nbsp;</div>
              <div className='text-2xl text-yellow-500'>
                {gameState.mode?.toUpperCase() || 'AUTO'}
              </div>
            </div> */}
          </footer>
        </div>
      </div>

      {/* Connection Status */}
      {/* <div className='absolute top-4 right-4 z-50'>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isConnected 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full inline-block mr-2 ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div> */}

      {/* Bottom disclaimer - Marquee */}
      <div className="absolute bottom-0 w-full text-xl py-1 text-red-800 overflow-hidden">
        <div className="whitespace-nowrap animate-marquee">
          THIS IS AN ELECTRONIC GAME INCASE OF ANY GRIEVANCES THE MANAGEMENT
          DECISION WILL BE FINAL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; •
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; THIS IS AN ELECTRONIC GAME INCASE OF
          ANY GRIEVANCES THE MANAGEMENT DECISION WILL BE FINAL
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; THIS
          IS AN ELECTRONIC GAME INCASE OF ANY GRIEVANCES THE MANAGEMENT DECISION
          WILL BE FINAL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; •
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; THIS IS AN ELECTRONIC GAME INCASE OF
          ANY GRIEVANCES THE MANAGEMENT DECISION WILL BE FINAL
        </div>
      </div>
    </div>
  );
};

export default DisplayPage;
