import asyncio
import websockets
import json
import motor.motor_asyncio
from datetime import datetime
import random
import copy

# MongoDB setup
MONGO_URI = "mongodb://localhost:27017"
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client["blackjack_db"]
results_collection = db["game_results"]

connected_clients = set()

def log_function_call(func_name, *args, **kwargs):
    """Helper function to log function calls with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    args_str = ", ".join([str(arg) for arg in args])
    kwargs_str = ", ".join([f"{k}={v}" for k, v in kwargs.items()])
    params = ", ".join(filter(None, [args_str, kwargs_str]))
    print(f"[{timestamp}] Function called: {func_name}({params})")

def create_deck():
    """Creates 6 standard 52-card decks for Blackjack"""
    log_function_call("create_deck")
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
    suits = ["S", "D", "C", "H"]
    deck = [rank + suit for rank in ranks for suit in suits] * 6
    random.shuffle(deck)
    return deck

# Global game state
game_state = {
    "deck": create_deck(),
    "round_number": 0,
    "min_bet": 0,
    "max_bet": 0,
    "dealer": {"cards": [], "total": 0, "hidden_card": None, "revealed": False, "status": "playing", "result": ""},
    "players": {
        "player1": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        },
        "player2": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        },
        "player3": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        },
        "player4": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        },
        "player5": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        },
        "player6": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        }
    },
    "max_players": 6,
    "current_player": None,  # Currently selected player
    "selected_hand": None,   # Currently selected hand (0: main, 1: split1, 2: split2)
    "game_phase": "waiting",
    "table_number": 1,
    "action_history": [],
    "auto_reshuffle_threshold": 52
}

def get_card_value(card):
    """Returns numerical value of a card"""
    log_function_call("get_card_value", card=card)
    rank = card[:-1]
    return 10 if rank in ['J', 'Q', 'K', 'T'] else 11 if rank == 'A' else int(rank)

def calculate_hand_value(cards):
    """Calculates best possible hand value, handling Aces"""
    log_function_call("calculate_hand_value", cards=cards)
    total = sum(get_card_value(card) for card in cards)
    aces = sum(1 for card in cards if card[:-1] == 'A')
    
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return total

def is_blackjack(cards):
    log_function_call("is_blackjack", cards=cards)
    return len(cards) == 2 and calculate_hand_value(cards) == 21

def is_bust(cards):
    log_function_call("is_bust", cards=cards)
    return calculate_hand_value(cards) > 21

def can_split(cards):
    """Check if cards can be split - must be exactly the same card"""
    log_function_call("can_split", cards=cards)
    return len(cards) == 2 and cards[0] == cards[1]  # Check for exact match (same rank AND suit)

def can_surrender(player_cards, dealer_upcard):
    """Check surrender conditions"""
    log_function_call("can_surrender", player_cards=player_cards, dealer_upcard=dealer_upcard)
    return (len(player_cards) == 2 and 
            not is_blackjack(player_cards) and 
            dealer_upcard[:-1] not in ['A', 'T', 'J', 'Q', 'K'])

def should_auto_reshuffle():
    log_function_call("should_auto_reshuffle")
    return len(game_state["deck"]) < game_state["auto_reshuffle_threshold"]

async def save_action_history(action, data):
    """Save action for undo functionality"""
    log_function_call("save_action_history", action=action, data=data)
    
    # Create a deep copy of the current game state
    current_state = copy.deepcopy(game_state)
    
    # Add the action to history with timestamp and state
    game_state["action_history"].append({
        "action": action,
        "data": copy.deepcopy(data),
        "timestamp": datetime.utcnow(),
        "game_state_snapshot": current_state
    })
    
    # Keep only last 5 actions
    if len(game_state["action_history"]) > 5:
        game_state["action_history"] = game_state["action_history"][-5:]
        print(f"Action history trimmed to last 5 actions. Current history: {[a['action'] for a in game_state['action_history']]}")

def serialize_game_state():
    """Convert game state to JSON format"""
    log_function_call("serialize_game_state")
    return {
        "deck_count": len(game_state["deck"]),
        "dealer": {
            "cards": game_state["dealer"]["cards"],
            "total": game_state["dealer"]["total"],
            "revealed": game_state["dealer"]["revealed"],
            "hidden_card": game_state["dealer"]["hidden_card"] if game_state["dealer"]["revealed"] else None,
            "status": game_state["dealer"]["status"]
        },
        "players": {
            pid: {
                "hands": pdata["hands"],
                "split1": pdata["split1"],
                "split1_status": pdata["split1_status"],
                "split2": pdata["split2"],
                "split2_status": pdata["split2_status"],
                "status": pdata["status"]
            }
            for pid, pdata in game_state["players"].items()
        },
        "game_phase": game_state["game_phase"],
        "current_player": game_state["current_player"],
        "selected_hand": game_state["selected_hand"],
        "table_number": game_state["table_number"],
        "round_number": game_state["round_number"]
    }

async def broadcast(message):
    """Send message to all connected clients"""
    log_function_call("broadcast", message=message)
    print("\n=== BROADCAST STARTED ===")
    print(f"Message to broadcast: {message}")
    print(f"Number of connected clients: {len(connected_clients)}")
    
    if connected_clients:
        try:
            print("Attempting to broadcast to all clients...")
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in connected_clients],
                return_exceptions=True
            )
            print("Broadcast completed successfully")
        except Exception as e:
            print(f"Error during broadcast: {str(e)}")
            print("Error type:", type(e))
            import traceback
            print("Traceback:", traceback.format_exc())
    else:
        print("No connected clients to broadcast to")
    print("=== BROADCAST COMPLETED ===\n")

async def handle_connection(websocket):
    """Handle new client connections"""
    log_function_call("handle_connection", websocket=websocket.remote_address)
    connected_clients.add(websocket)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}] Client connected: {websocket.remote_address}")

    # Send current game state immediately on connection
    await websocket.send(json.dumps({
        "action": "update_game_state",
        "game_state": serialize_game_state()
    }))

    # If game is in progress, also send turn update
    if game_state["game_phase"] == "playing":
        await websocket.send(json.dumps({
            "action": "turn_updated",
            "current_player": game_state["current_player"],
            "game_state": serialize_game_state()
        }))

    # Action handlers mapping
    action_handlers = {
        "set_game_mode": lambda d: handle_set_game_mode(d.get("mode")),
        "reshuffle": lambda d: handle_reshuffle(),
        "activate_player": lambda d: handle_activate_player(d.get("player_id")),
        "remove_player": lambda d: handle_remove_player(d.get("player_id")),
        "hit_player": lambda d: handle_hit_player(d.get("player_id"), d.get("hand_index", 0), d.get("card")),
        "stand_player": lambda d: handle_next_turn(),
        "split_player_auto": lambda d: handle_split_player_auto(d.get("player_id")),
        "split_player_manual": lambda d: handle_split_player_manual(d.get("player_id")),
        "reset_round": lambda d: handle_reset_round(),
        "undo_last": lambda d: handle_undo_last(),
        "set_table_number": lambda d: handle_set_table_number(d.get("table_number")),
        "reset_game": lambda d: handle_reset_game(),
        "next_turn": lambda d: handle_next_turn(),
        "start_game": lambda d: handle_start_game()
    }

    try:
        async for message in websocket:
            data = json.loads(message)
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            print(f"[{timestamp}] Received: {data}")
            
            handler = action_handlers.get(data["action"])
            if handler:
                await handler(data)

    except websockets.ConnectionClosed:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] Client disconnected: {websocket.remote_address}")
    finally:
        connected_clients.remove(websocket)

async def handle_set_game_mode(mode):
    log_function_call("handle_set_game_mode", mode=mode)
    if mode in ["live", "auto", "manual"]:
        game_state["game_mode"] = mode
        await broadcast({"action": "mode_changed", "mode": mode, "message": f"Game mode set to {mode.title()}"})
    log_game_state()

async def handle_reshuffle():
    log_function_call("handle_reshuffle")
    game_state["deck"] = create_deck()
    await broadcast({
        "action": "deck_reshuffled",
        "deck_count": len(game_state["deck"]),
        "message": "Deck reshuffled to 6 full decks (312 cards)"
    })
    log_game_state()

async def handle_activate_player(player_id=None):
    log_function_call("handle_activate_player", player_id=player_id)
    # Count active players (status = 1)
    active_players = get_active_players()
    
    if len(active_players) >= game_state["max_players"]:
        await broadcast({"action": "error", "message": "Maximum players reached"})
        return
    
    if player_id and player_id in game_state["players"]:
        # Activate specific player if provided and exists
        if game_state["players"][player_id]["status"] == 0:
            game_state["players"][player_id].update({
                "status": 1,
                "hands": [{"cards": [], "total": 0, "status": "playing", "result": ""}]
            })
            
            # If this is the first active player, set them as current player
            if len(active_players) == 0:
                game_state["current_player"] = player_id
                game_state["game_phase"] = "waiting"
            
            # Set this player as selected when activating
            game_state["selected_hand"] = {
                "player_id": player_id,
                "hand_index": 0,
                "split_level": 0
            }
            
            await broadcast({
                "action": "player_activated",
                "player_id": player_id,
                "message": f"Player {player_id} has been activated",
                "current_player": game_state["current_player"],
                "selected_hand": game_state["selected_hand"],
                "game_state": serialize_game_state()
            })
        else:
            await broadcast({
                "action": "error",
                "message": f"Player {player_id} is already active"
            })
    else:
        await broadcast({
            "action": "error",
            "message": f"Invalid player ID: {player_id}"
        })
    log_game_state()

async def handle_remove_player(player_id):
    log_function_call("handle_remove_player", player_id=player_id)
    if not player_id or player_id not in game_state["players"]:
        await broadcast({
            "action": "error",
            "message": f"Invalid player ID: {player_id}"
        })
        return
    
    if game_state["players"][player_id]["status"] == 0:
        await broadcast({
            "action": "error",
            "message": f"Player {player_id} is already inactive"
        })
        return
    
    # Reset player state
    game_state["players"][player_id].update({
        "status": 0,
        "hands": [{"cards": [], "total": 0, "status": "playing", "result": ""}]
    })
    
    # If removing current player, update to next active player
    if game_state["current_player"] == player_id:
        active_players = get_active_players()
        if active_players:
            game_state["current_player"] = active_players[0]
        else:
            game_state["current_player"] = None
            game_state["game_phase"] = "waiting"
    
    # Clear selected hand if it was the removed player
    if game_state["selected_hand"] and game_state["selected_hand"]["player_id"] == player_id:
        game_state["selected_hand"] = None
    
    # Broadcast the update to all clients
    await broadcast({
        "action": "player_removed",
        "player_id": player_id,
        "message": f"Player {player_id} has been deactivated",
        "current_player": game_state["current_player"],
        "selected_hand": game_state["selected_hand"],
        "game_state": serialize_game_state()
    })
    log_game_state()

async def handle_hit_player(player_id, hand_index=0, card=None):
    """Add a card to a player's hand"""
    log_function_call("handle_hit_player", player_id=player_id, hand_index=hand_index, card=card)
    print("\n=== HANDLE HIT PLAYER STARTED ===")
    print(f"Input parameters - player_id: {player_id}, hand_index: {hand_index}, card: {card}")
    
    try:
        # Validate player exists
        if player_id not in game_state["players"]:
            print(f"Error: Invalid player ID {player_id}")
            await broadcast({
                "action": "error",
                "message": f"Invalid player ID: {player_id}"
            })
            return
        
        # Get player data
        player = game_state["players"][player_id]
        print(f"Player {player_id} current state:", player)

        # Check if player is active
        if player["status"] != 1:
            print(f"Error: Player {player_id} is not active")
            await broadcast({
                "action": "error",
                "message": f"Player {player_id} is not active"
            })
            return
        
        # Get the current hand based on split level
        hand = None
        split_level = 0
        
        # Check if we're dealing with a split hand
        if game_state["selected_hand"] and game_state["selected_hand"]["player_id"] == player_id:
            split_level = game_state["selected_hand"]["split_level"]
            if split_level == 1:
                if hand_index >= len(player["split1"]):
                    await broadcast({"action": "error", "message": "Invalid hand index"})
                    return
                hand = player["split1"][hand_index]
            elif split_level == 2:
                if hand_index >= len(player["split2"]):
                    await broadcast({"action": "error", "message": "Invalid hand index"})
                    return
                hand = player["split2"][hand_index]
            else:
                if hand_index >= len(player["hands"]):
                    await broadcast({"action": "error", "message": "Invalid hand index"})
                    return
                hand = player["hands"][hand_index]
        else:
            # Default to main hand if no split level specified
            if hand_index >= len(player["hands"]):
                await broadcast({"action": "error", "message": "Invalid hand index"})
                return
            hand = player["hands"][hand_index]
        
        print(f"Current hand before hit:", hand)

        # If a specific card is provided
        if card:
            print(f"Using provided card: {card}")
            # Validate card format (e.g., "AS", "10H", etc.)
            if not (len(card) >= 2 and card[-1] in ['S', 'D', 'C', 'H']):
                print(f"Error: Invalid card format {card}")
                await broadcast({
                    "action": "error",
                    "message": "Invalid card format"
                })
                return
            # Remove the card from deck if it exists
            if card in game_state["deck"]:
                game_state["deck"].remove(card)
            else:
                print(f"Error: Card {card} not available in deck")
                await broadcast({
                    "action": "error",
                    "message": "Card not available in deck"
                })
                return
        else:
            # Draw random card if none specified
            if not game_state["deck"]:
                print("Error: Deck is empty")
                await broadcast({
                    "action": "error",
                    "message": "Deck is empty"
                })
                return
            card = game_state["deck"].pop()
            print(f"Drew random card: {card}")

        # Add card to hand
        hand["cards"].append(card)
        print(f"Cards after adding: {hand['cards']}")

        # Calculate new total
        hand["total"] = calculate_hand_value(hand["cards"])
        print(f"New total: {hand['total']}")
    
        # Update hand status
        if hand["status"] == "waiting":
            hand["status"] = "playing"
        if is_bust(hand["cards"]):
            hand["status"] = "bust"
            print(f"Hand busted with total {hand['total']}")
            # Automatically stand if bust
            await handle_next_turn()
        elif is_blackjack(hand["cards"]):
            hand["status"] = "blackjack"
            print(f"Blackjack!")
            # Automatically stand if blackjack
            await handle_next_turn()

        # Save action to history
        print("Saving action to history...")
        history_data = {
            "player_id": player_id,
            "hand_index": hand_index,
            "split_level": split_level,
            "card": card
        }
        print(f"History data: {history_data}")
        await save_action_history("hit_player", history_data)
        print("Action saved to history")

        # Broadcast updated game state
        print("Broadcasting updated game state...")
        broadcast_data = {
            "action": "player_hit",
            "player_id": player_id,
            "hand_index": hand_index,
            "split_level": split_level,
            "card": card,
            "game_state": serialize_game_state()
        }
        print(f"Broadcast data: {broadcast_data}")
        await broadcast(broadcast_data)
        print("Game state broadcasted")

        print("\n=== HANDLE HIT PLAYER COMPLETED ===")
        print("Updated player state:", game_state["players"][player_id])
        log_game_state()

    except Exception as e:
        print(f"Error in handle_hit_player: {str(e)}")
        print("Full error:", e)
        print("Error type:", type(e))
        import traceback
        print("Traceback:", traceback.format_exc())
        await broadcast({
            "action": "error",
            "message": f"Error adding card: {str(e)}"
        })

def log_game_state():
    print("hi")

def get_last_active_hand():
    """Get the last active hand in the game (excluding dealer)"""
    active_hands = get_active_hands()
    if not active_hands:
        return None
    
    # Filter out dealer hands and return the last player hand
    player_hands = [hand for hand in active_hands if hand["player_id"] != "dealer"]
    if not player_hands:
        return None
    
    return player_hands[-1]

async def handle_split_player_auto(player_id):
    """Handle player split in auto mode"""
    try:
        log_function_call("handle_split_player_auto", player_id=player_id)
        player_data = game_state["players"][player_id]
        
        # Check if player can split
        if not can_split(player_data["hands"][0]["cards"]):
            await broadcast({"action": "error", "message": "Cannot split this hand"})
            return
        
        # Save current state for undo
        await save_action_history("split", {
            "player_id": player_id,
            "old_state": serialize_game_state()
        })
        
        # Get the cards to split
        card1, card2 = player_data["hands"][0]["cards"]
        
        # Update main hand
        player_data["hands"][0]["cards"] = [card1]
        player_data["hands"][0]["total"] = get_card_value(card1)
        player_data["hands"][0]["status"] = "playing"
        
        # Create split1 hand
        player_data["split1"] = [{
            "cards": [card2],
            "total": get_card_value(card2),
            "status": "playing",
            "result": ""
        }]
        player_data["split1_status"] = 1
        
        # Update active hands list
        active_hands = get_active_hands()
        last_hand = get_last_active_hand()
        
        # Set current player and selected hand to the last active hand
        if last_hand:
            game_state["current_player"] = last_hand["player_id"]
            game_state["selected_hand"] = {
                "player_id": last_hand["player_id"],
                "hand_index": last_hand["hand_index"],
                "split_level": last_hand["split_level"]
            }
        
        # Broadcast split update
        await broadcast({
            "action": "split_completed",
            "player_id": player_id,
            "game_state": serialize_game_state()
        })
        
        print(f"=== SPLIT COMPLETED FOR PLAYER {player_id} ===")
        log_game_state()
    except Exception as e:
        print(f"Error in handle_split_player_auto: {str(e)}")
        await broadcast({"action": "error", "message": f"Error in split: {str(e)}"})

async def handle_split_player_manual(player_id):
    """Handle splitting a player's hand into two separate hands in manual mode"""
    log_function_call("handle_split_player_manual", player_id=player_id)
    
    if not player_id or player_id not in game_state["players"]:
        await broadcast({"action": "error", "message": "Invalid player ID"})
        return
    
    player_data = game_state["players"][player_id]
    
    # Find the active hand that can be split
    active_hand = None
    split_level = None
    
    # Check hands in order: main hands -> split1 -> split2
    if len(player_data["hands"]) > 0 and len(player_data["hands"][0]["cards"]) == 2:
        active_hand = player_data["hands"][0]
        split_level = 0
    elif len(player_data["split1"]) > 0 and len(player_data["split1"][0]["cards"]) == 2:
        active_hand = player_data["split1"][0]
        split_level = 1
    elif len(player_data["split2"]) > 0 and len(player_data["split2"][0]["cards"]) == 2:
        active_hand = player_data["split2"][0]
        split_level = 2
    
    # Validate conditions for splitting
    if not active_hand:
        await broadcast({"action": "error", "message": "Cannot split - invalid conditions"})
        return
    
    # Validate that the cards are of the same rank
    if not can_split(active_hand["cards"]):
        await broadcast({"action": "error", "message": "Cannot split - cards must be of same rank"})
        return
    
    # Save action to history before modifying state
    await save_action_history("split_player", {
        "player_id": player_id,
        "original_hand": copy.deepcopy(active_hand),
        "split_level": split_level
    })
    
    # Split the cards
    card1, card2 = active_hand["cards"]
    
    # Update the original hand with first card
    active_hand["cards"] = [card1]
    active_hand["total"] = calculate_hand_value([card1])
    active_hand["status"] = "playing"
    
    # Create new hand with second card
    new_hand = {
        "cards": [card2],
        "total": calculate_hand_value([card2]),
        "status": "playing",
        "result": ""
    }
    
    # Add new hand to the appropriate split level
    if split_level == 0:
        # First split goes to split1
        player_data["split1"] = [new_hand]  # Replace instead of append
        player_data["split1_status"] = 1  # Mark split1 as active
    elif split_level == 1:
        # Second split goes to split2
        player_data["split2"] = [new_hand]  # Replace instead of append
        player_data["split2_status"] = 1
    else:
        await broadcast({"action": "error", "message": "Maximum splits reached"})
        return
    
    # If the original hand was blackjack, it's no longer blackjack after split
    if active_hand.get("blackjack", False):
        active_hand["blackjack"] = False
        active_hand["status"] = "playing"
    
    await broadcast({
        "action": "player_split",
        "player_id": player_id,
        "split_level": split_level,
        "game_state": serialize_game_state()
    })
    
    log_game_state()

async def calculate_results():
    """Calculate win/lose/draw results for all players"""
    log_function_call("calculate_results")
    dealer_total = game_state["dealer"]["total"]
    dealer_blackjack = is_blackjack(game_state["dealer"]["cards"])
    dealer_bust = is_bust(game_state["dealer"]["cards"])
    
    results = []
    
    for player_id, player_data in game_state["players"].items():
        # Check main hands
        for hand_index, hand in enumerate(player_data["hands"]):
            if hand["status"] == "waiting":
                continue
                
            result = calculate_hand_result(hand, dealer_total, dealer_blackjack, dealer_bust)
            hand["result"] = result
            results.append({
                "player_id": player_id,
                "hand_index": hand_index,
                "split_level": 0,
                "result": result,
                "player_total": hand["total"],
                "dealer_total": dealer_total
            })
        
        # Check split1 hands
        for hand_index, hand in enumerate(player_data["split1"]):
            if hand["status"] == "waiting":
                continue
                
            result = calculate_hand_result(hand, dealer_total, dealer_blackjack, dealer_bust)
            hand["result"] = result
            results.append({
                "player_id": player_id,
                "hand_index": hand_index,
                "split_level": 1,
                "result": result,
                "player_total": hand["total"],
                "dealer_total": dealer_total
            })
        
        # Check split2 hands
        for hand_index, hand in enumerate(player_data["split2"]):
            if hand["status"] == "waiting":
                continue
                
            result = calculate_hand_result(hand, dealer_total, dealer_blackjack, dealer_bust)
            hand["result"] = result
            results.append({
                "player_id": player_id,
                "hand_index": hand_index,
                "split_level": 2,
                "result": result,
                "player_total": hand["total"],
                "dealer_total": dealer_total
            })
    
    await save_round_results(results)

def calculate_hand_result(hand, dealer_total, dealer_blackjack, dealer_bust):
    """Calculate result for a single hand"""
    player_total = hand["total"]
    player_blackjack = is_blackjack(hand["cards"])
    player_bust = is_bust(hand["cards"])
    
    if hand["status"] == "surrendered":
        return "surrender"
    elif player_bust:
        return "lose"
    elif dealer_bust and not player_bust:
        return "win"
    elif player_blackjack and not dealer_blackjack:
        return "blackjack_win"
    elif dealer_blackjack and not player_blackjack:
        return "lose"
    elif player_blackjack and dealer_blackjack:
        return "push"
    elif player_total > dealer_total:
        return "win"
    elif player_total < dealer_total:
        return "lose"
    else:
        return "push"

def calculate_payout(bet, result):
    """Calculate payout based on bet and result"""
    if result == "blackjack_win":
        return bet * 1.5  # 3:2 payout for blackjack
    elif result == "win":
        return bet  # 1:1 payout for regular win
    elif result == "push":
        return bet  # Return original bet for push
    elif result == "surrender":
        return bet * 0.5  # Return half bet for surrender
    else:  # lose
        return 0  # No payout for loss

async def save_round_results(results):
    """Save round results to MongoDB"""
    log_function_call("save_round_results", results=results)
    round_record = {
        "timestamp": datetime.utcnow(),
        "table_number": game_state["table_number"],
        "game_mode": game_state["game_mode"],
        "dealer_total": game_state["dealer"]["total"],
        "dealer_bust": is_bust(game_state["dealer"]["cards"]),
        "results": results
    }
    
    await results_collection.insert_one(round_record)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] Saved round results: {round_record}")

async def handle_reset_round():
    log_function_call("handle_reset_round")
    await save_action_history("reset_round", {})
    
    # Reset all players to waiting state
    for player_data in game_state["players"].values():
        if player_data["status"] == 1:  # Only reset active players
            player_data.update({
                "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split1_status": 0,
                "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split2_status": 0
            })
    
    # Reset dealer and game state
    game_state["dealer"].update({"cards": [], "total": 0, "hidden_card": None, "revealed": False, "status": "waitig"})
    game_state.update({
        "game_phase": "waiting", 
        "current_player": None,
        "selected_hand": None  # Clear selected hand on round reset
    })
    
    await broadcast({"action": "round_reset", "game_state": serialize_game_state()})
    log_game_state()

async def handle_undo_last():
    """Undo the last action and restore previous game state"""
    log_function_call("handle_undo_last")
    
    if not game_state["action_history"]:
        await broadcast({
            "action": "error", 
            "message": "No actions to undo"
        })
        return
    
    # Get the last action and its state
    last_action = game_state["action_history"].pop()
    previous_state = last_action["game_state_snapshot"]
    
    # Log the undo operation
    print(f"\n=== UNDOING ACTION ===")
    print(f"Action being undone: {last_action['action']}")
    print(f"Action data: {last_action['data']}")
    print(f"Timestamp: {last_action['timestamp']}")
    
    # Restore the previous state
    game_state.update({k: v for k, v in previous_state.items() if k != "action_history"})
    
    # Broadcast the undo completion
    await broadcast({
        "action": "undo_completed",
        "undone_action": last_action["action"],
        "message": f"Undid {last_action['action']} action",
        "game_state": serialize_game_state()
    })
    
    print(f"Remaining actions in history: {len(game_state['action_history'])}")
    print(f"Actions: {[a['action'] for a in game_state['action_history']]}")
    print("=== UNDO COMPLETED ===\n")
    
    log_game_state()

async def handle_set_table_number(table_number):
    log_function_call("handle_set_table_number", table_number=table_number)
    if table_number:
        game_state["table_number"] = table_number
        await broadcast({"action": "table_number_set", "table_number": table_number})
    log_game_state()

async def handle_reset_game():
    log_function_call("handle_reset_game")
    await save_action_history("reset_game", {})
    
    # Reset all players to original state
    for player_id, player_data in game_state["players"].items():
        player_data.update({
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0
        })
    
    # Reset dealer to original state
    game_state["dealer"] = {
        "cards": [],
        "total": 0,
        "hidden_card": None,
        "revealed": False,
        "status": "waiting"
    }
    
    # Reset game state to original state
    game_state.update({
        "game_phase": "waiting",
        "current_player": None,
        "selected_hand": None,  # Clear selected hand on game reset
        "deck": create_deck(),
        "action_history": [],
        "game_mode": "manual",  # Reset to default game mode
        "table_number": 1
    })
    
    # Broadcast the complete reset to all clients
    await broadcast({
        "action": "game_reset",
        "message": "Game has been completely reset to original state",
        "game_state": serialize_game_state()
    })
    log_game_state()

def get_active_hands():
    """Get all active hands in the game"""
    active_hands = []
    
    # Add player hands
    for player_id, player_data in game_state["players"].items():
        if player_data["status"] == 1:  # Only include active players
            # Add main hand if it's playing
            if player_data["hands"] and player_data["hands"][0]["status"] == "playing":
                active_hands.append({
                    "player_id": player_id,
                    "hand_index": 0,
                    "split_level": 0
                })
            
            # Add split1 hand if it's playing
            if player_data["split1_status"] == 1 and player_data["split1"] and player_data["split1"][0]["status"] == "playing":
                active_hands.append({
                    "player_id": player_id,
                    "hand_index": 0,
                    "split_level": 1
                })
            
            # Add split2 hand if it's playing
            if player_data["split2_status"] == 1 and player_data["split2"] and player_data["split2"][0]["status"] == "playing":
                active_hands.append({
                    "player_id": player_id,
                    "hand_index": 0,
                    "split_level": 2
                })
    
    # Add dealer's hand if it's the dealer's turn
    if game_state["dealer"]["status"] == "playing":
        active_hands.append({
            "player_id": "dealer",
            "hand_index": 0,
            "split_level": 0
        })
    
    return active_hands

async def handle_next_turn():
    """Handle moving to the next turn"""
    try:
        log_function_call("handle_next_turn")
        active_players = get_active_players()
        active_hands = get_active_hands()
        last_hand = get_last_active_hand()
        
        print("\n=== HANDLING NEXT TURN ===")
        print(f"Active Players: {active_players}")
        print(f"Active Hands: {active_hands}")
        print(f"Last Active Hand: {last_hand}")
        
        # If currently on dealer, move to first active player and their hand
        if game_state["game_phase"] == "dealer" and game_state["current_player"] == "dealer":
            print("Dealer phase complete - moving to first active player")
            # Find the first active player (excluding dealer)
            first_player = next((pid for pid in active_players if pid != "dealer"), None)
            if first_player:
                game_state["game_phase"] = "playing"
                game_state["current_player"] = first_player
                game_state["selected_hand"] = {
                    "player_id": first_player,
                    "hand_index": 0,
                    "split_level": 0
                }
                print(f"Moved to player: {first_player}")
            else:
                print("No active players found after dealer phase.")
                game_state["game_phase"] = "waiting"
                game_state["current_player"] = None
                game_state["selected_hand"] = None
        else:
            # Check if current hand is the last active hand
            current_hand = {
                "player_id": game_state["current_player"],
                "hand_index": game_state["selected_hand"]["hand_index"],
                "split_level": game_state["selected_hand"]["split_level"]
            } if game_state["selected_hand"] else None
            
            if current_hand and last_hand and current_hand["player_id"] == last_hand["player_id"] and \
               current_hand["hand_index"] == last_hand["hand_index"] and \
               current_hand["split_level"] == last_hand["split_level"]:
                print("Current hand is last active hand - moving to dealer")
                game_state["game_phase"] = "dealer"
                game_state["current_player"] = "dealer"
                game_state["selected_hand"] = {
                    "player_id": "dealer",
                    "hand_index": 0,
                    "split_level": 0
                }
            else:
                # Move to the next hand in the list
                current_index = next(
                    (i for i, hand in enumerate(active_hands)
                     if hand["player_id"] == game_state["current_player"]
                     and hand["hand_index"] == game_state["selected_hand"]["hand_index"]
                     and hand["split_level"] == game_state["selected_hand"]["split_level"]),
                    -1
                )

                # Find the next hand (could be player or dealer)
                next_hand = None
                for i in range(current_index + 1, len(active_hands)):
                    next_hand = active_hands[i]
                    break

                if next_hand:
                    if next_hand["player_id"] == "dealer":
                        print("Next hand is dealer - moving to dealer phase")
                        game_state["game_phase"] = "dealer"
                        game_state["current_player"] = "dealer"
                        game_state["selected_hand"] = {
                            "player_id": "dealer",
                            "hand_index": 0,
                            "split_level": 0
                        }
                    else:
                        game_state["current_player"] = next_hand["player_id"]
                        game_state["selected_hand"] = {
                            "player_id": next_hand["player_id"],
                            "hand_index": next_hand["hand_index"],
                            "split_level": next_hand["split_level"]
                        }
                        print(f"Moving to next hand: Player {next_hand['player_id']}, Split Level {next_hand['split_level']}")
                else:
                    # No more hands, fallback (should not happen)
                    print("No more hands found - fallback to dealer phase")
                    game_state["game_phase"] = "dealer"
                    game_state["current_player"] = "dealer"
                    game_state["selected_hand"] = {
                        "player_id": "dealer",
                        "hand_index": 0,
                        "split_level": 0
                    }
        
        print(f"New Current Player: {game_state['current_player']}")
        print(f"Selected Hand: {game_state['selected_hand']}")
        print(f"Game Phase: {game_state['game_phase']}")
        
        # Broadcast turn update
        await broadcast({
            "action": "turn_updated",
            "current_player": game_state["current_player"],
            "selected_hand": game_state["selected_hand"],
            "game_state": serialize_game_state()
        })
        print("=== TURN UPDATED ===\n")
        log_game_state()
    except Exception as e:
        print(f"Error in handle_next_turn: {str(e)}")
        await broadcast({"action": "error", "message": f"Error in next turn: {str(e)}"})

async def handle_start_game():
    """Start the game and set initial turn"""
    try:
        log_function_call("handle_start_game")
        active_players = get_active_players()
        active_hands = get_active_hands()

        print("\n=== STARTING GAME ===")

        print(f"Active Players: {active_players}")
        
        if not active_players:
            await broadcast({"action": "error", "message": "No active players"})
            return
        
        # Reset game state for new round
        game_state["round_number"] = 0
        game_state["game_phase"] = "player"
        game_state["current_player"] = active_players[0]
        game_state["selected_hand"] = {
            "player_id": active_players[0],
            "hand_index": 0,
            "split_level": 0
        }
        
        # Broadcast game start
        await broadcast({
            "action": "game_started",
            "current_player": game_state["current_player"],
            "selected_hand": game_state["selected_hand"],
            "game_state": serialize_game_state()
        })
        print("=== GAME STARTED ===\n")
        log_game_state()
    except Exception as e:
        print(f"Error in handle_start_game: {str(e)}")
        await broadcast({"action": "error", "message": f"Error starting game: {str(e)}"})

def get_active_players():
    """Get list of active player IDs"""
    active_players = [pid for pid, pdata in game_state["players"].items() if pdata["status"] == 1]
    # Add dealer at the end
    active_players.append("dealer")
    return active_players

def should_start_new_round():
    """Check if conditions are met to start a new round"""
    # Check if any player wants to continue
    active_players = get_active_players()
    if not active_players:
        return False
        
    # Check if all players have completed their hands
    for player_id in active_players:
        player_data = game_state["players"][player_id]
        if any(hand["status"] == "playing" for hand in player_data["hands"]):
            return False
            
    # Check if dealer needs to play
    if game_state["dealer"]["status"] not in ["standing", "bust"]:
        return False
        
    return True

async def main():
    log_function_call("main")
    async with websockets.serve(handle_connection, "localhost", 6790):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        print(f"[{timestamp}] Advanced Blackjack WebSocket server running on ws://localhost:6790")
        print(f"[{timestamp}] Features: Live/Auto/Manual modes, Split, Double Down, Surrender")
        print(f"[{timestamp}] 6-deck shoe with auto-reshuffle at < 52 cards")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())