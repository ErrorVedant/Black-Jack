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

# Store the last 5 game states for undo functionality
previous_game_states = []

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
    "dealer": {"cards": [], "total": 0, "status": "playing", "result": ""},
    "players": {
        "player1": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        },
        "player2": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        },
        "player3": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        },
        "player4": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        },
        "player5": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        },
        "player6": {
            "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split1_status": 0,
            "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
            "split2_status": 0,
            "status": 0,
            "insurence": 0
        }
    },
    "max_players": 7,
    "current_player": None,  # Currently selected player
    "selected_hand": None,   
    "game_phase": "waiting",
    "table_number": 1,
    "mode": "",
    "action_history": [],
    "auto_reshuffle_threshold": 52,
    "evaluate_game": False,  # Track whether game has been evaluated
    "next_manual_counter": 0,  # no 2 next_turn occur during round 0
    "manual_distribution_count": 0,  # each player gets 2 cards only in round 0
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
    """Check if cards can be split - must be same rank (number/letter), suit does not matter"""
    log_function_call("can_split", cards=cards)
    return len(cards) == 2 and cards[0][:-1] == cards[1][:-1]  # Only compare rank, not suit

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
    import copy
    # Save a deep copy of the current game state to previous_game_states
    previous_game_states.append(copy.deepcopy(game_state))
    if len(previous_game_states) > 10:
        previous_game_states.pop(0)  # Remove the oldest state

    # Only store action and data in action_history (no heavy snapshot)
    game_state["action_history"].append({
        "action": action,
        "data": copy.deepcopy(data),
        "timestamp": datetime.utcnow(),
    })
    if len(game_state["action_history"]) > 10:
        game_state["action_history"] = game_state["action_history"][-10:]

def serialize_game_state():
    """Convert game state to JSON format"""
    log_function_call("serialize_game_state")
    return {
        "deck_count": len(game_state["deck"]),
        "dealer": {
            "cards": game_state["dealer"]["cards"],
            "total": game_state["dealer"]["total"],
            "status": game_state["dealer"]["status"],
            "result": game_state["dealer"].get("result", "")
        },
        "players": {
            pid: {
                "hands": pdata["hands"],
                "split1": pdata["split1"],
                "split1_status": pdata["split1_status"],
                "split2": pdata["split2"],
                "split2_status": pdata["split2_status"],
                "status": pdata["status"],
                "insurence": pdata.get("insurence", 0)
            }
            for pid, pdata in game_state["players"].items()
        },
        "game_phase": game_state["game_phase"],
        "current_player": game_state["current_player"],
        "selected_hand": game_state["selected_hand"],
        "table_number": game_state["table_number"],
        "round_number": game_state["round_number"],
        "mode": game_state["mode"],
        "evaluate_game": game_state["evaluate_game"],
        "next_manual_counter": game_state["next_manual_counter"],
        "manual_distribution_count": game_state["manual_distribution_count"]
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
        "double_player": lambda d: handle_hit_player(d.get("player_id"), d.get("hand_index", 0), d.get("card")),
        "hit_player": lambda d: handle_hit_player(d.get("player_id"), d.get("hand_index", 0), d.get("card")),
        "hit_dealer": lambda d: handle_hit_player("dealer", 0, d.get("card")),
        "stand_player": lambda d: handle_next_turn(),
        "split_player_auto": lambda d: handle_split_player_auto(d.get("player_id")),
        "split_player_manual": lambda d: handle_split_player_manual(d.get("player_id")),
        "reset_round": lambda d: handle_reset_round(),
        "undo_last": lambda d: handle_undo_last(),
        "set_table_number": lambda d: handle_set_table_number(d.get("table_number")),
        "reset_game": lambda d: handle_reset_game(),
        "next_turn": lambda d: handle_next_turn(),
        "start_game": lambda d: handle_start_game(),
        "manual_start": lambda d: handle_manual_start(),
        "distribute_cards": lambda d: handle_distribute_cards_auto(),
        "insurence": lambda d: handle_insurence(d.get("player_id"), d.get("hand_index", 0), d.get("split_level", 0)),
        "dealer_auto_play": lambda d: handle_dealer_value_less_then_17(),
        "evaluate_game": lambda d: evaluate_game(),
        "set_manual_distribution_count": lambda d: handle_set_manual_distribution_count(d.get("value")),
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
    """Add a card to a player's hand or the dealer's hand"""
    log_function_call("handle_hit_player", player_id=player_id, hand_index=hand_index, card=card)
    print("\n=== HANDLE HIT PLAYER STARTED ===")
    print(f"Input parameters - player_id: {player_id}, hand_index: {hand_index}, card: {card}")
    try:
        if ((game_state["mode"] == "manual" and game_state["round_number"] == 0) or (game_state["mode"] == "auto" and game_state["round_number"] == 0) or game_state["round_number"] == 1):
            game_state["next_manual_counter"] = 1
            if player_id == "dealer":
                hand = game_state["dealer"]
                # If a specific card is provided
                if card:
                    if not (len(card) >= 2 and card[-1] in ['S', 'D', 'C', 'H']):
                        await broadcast({"action": "error", "message": "Invalid card format"})
                        return
                    if card in game_state["deck"]:
                        game_state["deck"].remove(card)
                    else:
                        await broadcast({"action": "error", "message": "Card not available in deck"})
                        return
                else:
                    if not game_state["deck"]:
                        await broadcast({"action": "error", "message": "Deck is empty"})
                        return
                    card = game_state["deck"].pop()

                hand["cards"].append(card)
                hand["total"] = calculate_hand_value(hand["cards"])
                if game_state["round_number"] == 0:
                    game_state["manual_distribution_count"] = game_state["manual_distribution_count"] + 1

                if is_bust(hand["cards"]):
                    hand["status"] = "bust"
                    hand["result"] = "fail"
                elif is_blackjack(hand["cards"]):
                    hand["status"] = "blackjack"
                    hand["result"] = "win"
                else:
                    hand["status"] = "playing"
                
                await save_action_history("hit_dealer", {"card": card})
                await broadcast({
                    "action": "dealer_hit",
                    "card": card,
                    "game_state": serialize_game_state()
                })
                print("=== HANDLE HIT DEALER COMPLETED ===")
                log_game_state()
                return

            # Validate player exists
            if player_id not in game_state["players"]:
                print(f"Error: Invalid player ID {player_id}")
                await broadcast({
                    "action": "error",
                    "message": f"Invalid player ID: {player_id}"
                })
                return
            
            player = game_state["players"][player_id]
            print(f"Player {player_id} current state:", player)
            
            if player["status"] != 1:
                print(f"Error: Player {player_id} is not active")
                await broadcast({
                    "action": "error",
                    "message": f"Player {player_id} is not active"
                })
                return
            
            hand = None
            split_level = 0
            
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
                if hand_index >= len(player["hands"]):
                    await broadcast({"action": "error", "message": "Invalid hand index"})
                    return
                hand = player["hands"][hand_index]
            
            print(f"Current hand before hit:", hand)
            
            if card:
                print(f"Using provided card: {card}")
                if not (len(card) >= 2 and card[-1] in ['S', 'D', 'C', 'H']):
                    print(f"Error: Invalid card format {card}")
                    await broadcast({
                        "action": "error",
                        "message": "Invalid card format"
                    })
                    return
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
                if not game_state["deck"]:
                    print("Error: Deck is empty")
                    await broadcast({
                        "action": "error",
                        "message": "Deck is empty"
                    })
                    return
                card = game_state["deck"].pop()
                print(f"Drew random card: {card}")
            
            hand["cards"].append(card)
            print(f"Cards after adding: {hand['cards']}")
            hand["total"] = calculate_hand_value(hand["cards"])
            if game_state["round_number"] == 0:
                game_state["manual_distribution_count"] = game_state["manual_distribution_count"] + 1
            print(f"New total: {hand['total']}")
            
            if hand["status"] == "waiting":
                hand["status"] = "playing"
            
            if is_bust(hand["cards"]):
                hand["status"] = "bust"
                hand["result"] = "fail"
                print(f"Hand busted with total {hand['total']}")
                await handle_next_turn()
            elif is_blackjack(hand["cards"]):
                hand["status"] = "blackjack"
                hand["result"] = "win"
                print(f"Blackjack!")
                if game_state["round_number"] == 1:
                    await handle_next_turn()
            elif hand["total"] == 21:
                hand["result"] = "win"
                await handle_next_turn()
            
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
        import traceback
        print("Traceback:", traceback.format_exc())
        await broadcast({
            "action": "error",
            "message": f"Error adding card: {str(e)}"
        })

def log_game_state():
    print("hi")

def get_last_active_hand():
    """Get the last possible player hand in the game (excluding dealer)"""
    last_hand = None
    for player_id, player_data in game_state["players"].items():
        if player_data["status"] == 1:
            # Main hand
            last_hand = {
                "player_id": player_id,
                "hand_index": 0,
                "split_level": 0
            }
            # Split1
            if player_data["split1_status"] == 1:
                last_hand = {
                    "player_id": player_id,
                    "hand_index": 0,
                    "split_level": 1
                }
            # Split2
            if player_data["split2_status"] == 1:
                last_hand = {
                    "player_id": player_id,
                    "hand_index": 0,
                    "split_level": 2
                }
    return last_hand

async def handle_split_player_manual(player_id):
    """Handle splitting a player's hand into two separate hands"""
    log_function_call("handle_split_player_manual", player_id=player_id)

    if not player_id or player_id not in game_state["players"]:
        await broadcast({"action": "error", "message": "Invalid player ID"})
        return
    
    player_data = game_state["players"][player_id]
    
    selected = game_state.get("selected_hand")
    if not selected or selected["player_id"] != player_id:
        await broadcast({"action": "error", "message": "No selected hand for this player to split"})
        return
    split_level = selected["split_level"]
    if split_level == 0:
        hand_list = player_data["hands"]
    elif split_level == 1:
        hand_list = player_data["split1"]
    elif split_level == 2:
        hand_list = player_data["split2"]
    else:
        await broadcast({"action": "error", "message": "Invalid split level"})
        return
    if len(hand_list) == 0 or len(hand_list[0]["cards"]) != 2:
        await broadcast({"action": "error", "message": "Cannot split - no valid hand found"})
        return
    active_hand = hand_list[0]

    # Validate conditions for splitting
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
    if split_level == 0:  # Splitting main hand
        if player_data["split1_status"] == 0:
            player_data["split1"] = [new_hand]
            player_data["split1_status"] = 1
        elif player_data["split2_status"] == 0:
            player_data["split2"] = [new_hand]
            player_data["split2_status"] = 1
        else:
            await broadcast({"action": "error", "message": "Maximum splits reached"})
        return
    elif split_level == 1:  # Splitting split1
        if player_data["split2_status"] == 0:
            player_data["split2"] = [new_hand]
            player_data["split2_status"] = 1
        else:
            await broadcast({"action": "error", "message": "Maximum splits reached"})
        return
    elif split_level == 2:  # Splitting split2
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

async def handle_split_player_auto(player_id):
    """Handle splitting a player's hand into two separate hands"""
    log_function_call("handle_split_player_auto", player_id=player_id)

    if not player_id or player_id not in game_state["players"]:
        await broadcast({"action": "error", "message": "Invalid player ID"})
        return
    
    player_data = game_state["players"][player_id]
    
    selected = game_state.get("selected_hand")
    if not selected or selected["player_id"] != player_id:
        await broadcast({"action": "error", "message": "No selected hand for this player to split"})
        return
    split_level = selected["split_level"]
    if split_level == 0:
        hand_list = player_data["hands"]
    elif split_level == 1:
        hand_list = player_data["split1"]
    elif split_level == 2:
        hand_list = player_data["split2"]
    else:
        await broadcast({"action": "error", "message": "Invalid split level"})
        return
    if len(hand_list) == 0 or len(hand_list[0]["cards"]) != 2:
        await broadcast({"action": "error", "message": "Cannot split - no valid hand found"})
        return
    active_hand = hand_list[0]

    # Validate conditions for splitting
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
    if split_level == 0:  # Splitting main hand
        if player_data["split1_status"] == 0:
            player_data["split1"] = [new_hand]
            player_data["split1_status"] = 1
        elif player_data["split2_status"] == 0:
            player_data["split2"] = [new_hand]
            player_data["split2_status"] = 1
        else:
            await broadcast({"action": "error", "message": "Maximum splits reached"})
            return
    elif split_level == 1:  # Splitting split1
        if player_data["split2_status"] == 0:
            player_data["split2"] = [new_hand]
            player_data["split2_status"] = 1
        else:
            await broadcast({"action": "error", "message": "Maximum splits reached"})
            return
    elif split_level == 2:  # Splitting split2
        await broadcast({"action": "error", "message": "Maximum splits reached"})
        return
    
    # If the original hand was blackjack, it's no longer blackjack after split
    if active_hand.get("blackjack", False):
        active_hand["blackjack"] = False
        active_hand["status"] = "playing"
    
    # Deal new cards to both split hands
    for hand in [active_hand, new_hand]:
        if len(game_state["deck"]) > 0:
            new_card = game_state["deck"].pop()
            hand["cards"].append(new_card)
            hand["total"] = calculate_hand_value(hand["cards"])
    
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

    # Reset all players to waiting state, but do not touch the deck
    for player_data in game_state["players"].values():
        if player_data["status"] == 1:  # Only reset active players
            player_data.update({
                "hands": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split1": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split1_status": 0,
                "split2": [{"cards": [], "total": 0, "status": "waiting", "result": ""}],
                "split2_status": 0,
                "insurence": 0
            })

    # Reset dealer and game state (do not touch deck)
    game_state["dealer"].update({"cards": [], "total": 0, "status": "waiting", "result": ""})
    game_state.update({
        "game_phase": "waiting",
        "current_player": None,
        "selected_hand": None,  # Clear selected hand on round reset
        "evaluate_game": False  # Reset evaluate_game flag
    })
    game_state["manual_distribution_count"] = 0  # Reset manual distribution count

    await broadcast({"action": "round_reset", "game_state": serialize_game_state()})
    log_game_state()

async def handle_undo_last():
    """Undo the last action and restore previous game state"""
    log_function_call("handle_undo_last")
    
    if not previous_game_states:
        await broadcast({
            "action": "error", 
            "message": "No actions to undo"
        })
        return
    
    # Remove the most recent state (current state)
    previous_game_states.pop()
    if not previous_game_states:
        await broadcast({
            "action": "error", 
            "message": "No previous state to restore"
        })
        return
    # Restore the previous state
    prev_state = previous_game_states[-1]
    # Update all keys in game_state except action_history and previous_game_states
    for k in prev_state:
        if k != "action_history":
            game_state[k] = copy.deepcopy(prev_state[k])
    # Remove the last action from action_history
    if game_state["action_history"]:
        last_action = game_state["action_history"].pop()
    else:
        last_action = None
    # Broadcast the undo completion
    await broadcast({
        "action": "undo_completed",
        "undone_action": last_action["action"] if last_action else None,
        "message": f"Undid {last_action['action']} action" if last_action else "Undid last action",
        "game_state": serialize_game_state()
    })
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
        "table_number": 1,
        "evaluate_game": False  # Reset evaluate_game flag
    })
    game_state["manual_distribution_count"] = 0  # Reset manual distribution count
    
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

def get_all_player_hands():
    """Return all possible player hands (main, split1, split2) in order, regardless of status, excluding dealer."""
    hands = []
    for player_id, player_data in game_state["players"].items():
        if player_data["status"] == 1:
            hands.append({"player_id": player_id, "hand_index": 0, "split_level": 0})
            if player_data["split1_status"] == 1:
                hands.append({"player_id": player_id, "hand_index": 0, "split_level": 1})
            if player_data["split2_status"] == 1:
                hands.append({"player_id": player_id, "hand_index": 0, "split_level": 2})
    return hands

async def handle_next_turn():
    """Handle moving to the next turn"""
    try:
        if (
    (
        game_state["mode"] == "manual" and
        game_state["next_manual_counter"] == 1 and
        game_state["round_number"] == 0 and
        (
            (game_state["manual_distribution_count"] == 2 and game_state["current_player"] != "dealer") or
            (game_state["manual_distribution_count"] == 1 and game_state["current_player"] == "dealer")
        )
    )
    or
    (
        game_state["mode"] == "auto" and
        game_state["next_manual_counter"] == 1 and
        game_state["round_number"] == 0 and
        (
            (game_state["manual_distribution_count"] == 2 and game_state["current_player"] != "dealer") or
            (game_state["manual_distribution_count"] == 1 and game_state["current_player"] == "dealer")
        )
    )
    or
    (
        game_state["round_number"] == 1
    )
):

            if (game_state["mode"] == "manual" and game_state["round_number"] == 0) or (game_state["mode"] == "auto" and game_state["round_number"] == 0):
                game_state["next_manual_counter"] = 0
            log_function_call("handle_next_turn")
            import copy
            # Save the current game state to previous_game_states as an action
            previous_game_states.append(copy.deepcopy(game_state))
            if len(previous_game_states) > 10:
                previous_game_states.pop(0)
            # Add to action_history as well
            game_state["action_history"].append({
                "action": "next_turn",
                "data": {},
                "timestamp": datetime.utcnow(),
            })
            if len(game_state["action_history"]) > 10:
                game_state["action_history"] = game_state["action_history"][-10:]
            active_players = get_active_players()
            all_hands = get_all_player_hands()
            last_hand = get_last_active_hand()
            
            print("\n=== HANDLING NEXT TURN ===")
            print(f"Active Players: {active_players}")
            print(f"All Hands: {all_hands}")
            print(f"Last Active Hand: {last_hand}")
            
            # If currently on dealer, move to first active player and their hand
            if game_state["game_phase"] == "dealer" and game_state["current_player"] == "dealer":
                print("Dealer phase complete - moving to first active player")
                # Find the first active player (excluding dealer)
                first_player = next((pid for pid in active_players if pid != "dealer"), None)
                if first_player:
                    # Set round number to 1 if it's currently 0 (do this only when moving to first player)
                    if game_state["round_number"] == 0:
                        game_state["round_number"] = 1
                        print("Round number set to 1")
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
                # Check if current hand is the last possible hand
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
                    # Move to the next hand in the full list (not just active hands)
                    current_index = next(
                        (i for i, hand in enumerate(all_hands)
                        if hand["player_id"] == game_state["current_player"]
                        and hand["hand_index"] == game_state["selected_hand"]["hand_index"]
                        and hand["split_level"] == game_state["selected_hand"]["split_level"]),
                        -1
                    )
                    next_hand = None
                    for i in range(current_index + 1, len(all_hands)):
                        next_hand = all_hands[i]
                        break
                    if next_hand:
                        game_state["current_player"] = next_hand["player_id"]
                        game_state["selected_hand"] = {
                            "player_id": next_hand["player_id"],
                            "hand_index": next_hand["hand_index"],
                            "split_level": next_hand["split_level"]
                        }
                        print(f"Moving to next hand: Player {next_hand['player_id']}, Split Level {next_hand['split_level']}")
                    else:
                        # No more hands, move to dealer
                        print("No more hands found - moving to dealer phase")
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
            if (game_state['round_number'] == 0):
                game_state['manual_distribution_count'] = 0
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

async def handle_manual_start():
    """Start the game in manual mode"""
    log_function_call("handle_manual_start")
    print("\n=== STARTING MANUAL GAME ===")
    # Set game mode to manual
    game_state["mode"] = "manual"
    await handle_start_game()  # Call handle_start_game at the start

       
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

async def handle_distribute_cards_auto():
    await handle_start_game()  # Call handle_start_game at the start
    game_state["mode"] = "auto"  # Set mode to auto
    # Check if all player hands and dealer hand are empty
    all_empty = True
    # Check dealer
    if game_state["dealer"]["cards"]:
        all_empty = False
    # Check all players
    for player_data in game_state["players"].values():
        if player_data["hands"][0]["cards"]:
            all_empty = False
        if player_data["split1"][0]["cards"]:
            all_empty = False
        if player_data["split2"][0]["cards"]:
            all_empty = False
    if all_empty:
        print("no cards assigned")
        # Distribute one card to each active player and dealer, with delay
        for player_id, player_data in game_state["players"].items():
            if player_data["status"] == 1:
                await handle_hit_player(player_id, 0)
                await handle_hit_player(player_id, 0)
                await handle_next_turn()
                await asyncio.sleep(2.0)
        await handle_hit_player("dealer", 0)
        await handle_next_turn()

        await broadcast({
            "action": "update_game_state",
            "game_state": serialize_game_state()
        })
    else:
        print("cards exist")

async def handle_dealer_value_less_then_17():
    """Keep hitting dealer until dealer's total is >= 17"""
    print('handle_dealer_value_less_then_17()')
    while game_state["dealer"]["total"] < 17:
        await handle_hit_player("dealer", 0)
        await asyncio.sleep(0.2)
    # Evaluate the game after dealer is done
    await evaluate_game()

async def evaluate_game():
    """Evaluate all active hands: if dealer bust, all hands <= 21 win, >21 fail; else if hand > dealer and <= 21, win; if hand == dealer and <= 21, tie; else fail."""
    log_function_call("evaluate_game")
    
    # Set evaluate_game to True to indicate game has been evaluated
    game_state["evaluate_game"] = True
    
    dealer_total = game_state["dealer"]["total"]
    dealer_bust = dealer_total > 21
    for player_id, player_data in game_state["players"].items():
        if player_data["status"] == 1:
            # Main hand
            hand = player_data["hands"][0]
            if dealer_bust:
                if hand["total"] <= 21:
                    hand["result"] = "win"
                else:
                    hand["result"] = "fail"
            else:
                if hand["total"] > dealer_total and hand["total"] <= 21:
                    hand["result"] = "win"
                elif hand["total"] == dealer_total and hand["total"] <= 21:
                    hand["result"] = "tie"
                else:
                    hand["result"] = "fail"
            # Split1
            if player_data["split1_status"] == 1 and player_data["split1"]:
                split1_hand = player_data["split1"][0]
                if dealer_bust:
                    if split1_hand["total"] <= 21:
                        split1_hand["result"] = "win"
                    else:
                        split1_hand["result"] = "fail"
                else:
                    if split1_hand["total"] > dealer_total and split1_hand["total"] <= 21:
                        split1_hand["result"] = "win"
                    elif split1_hand["total"] == dealer_total and split1_hand["total"] <= 21:
                        split1_hand["result"] = "tie"
                    else:
                        split1_hand["result"] = "fail"
            # Split2
            if player_data["split2_status"] == 1 and player_data["split2"]:
                split2_hand = player_data["split2"][0]
                if dealer_bust:
                    if split2_hand["total"] <= 21:
                        split2_hand["result"] = "win"
                    else:
                        split2_hand["result"] = "fail"
                else:
                    if split2_hand["total"] > dealer_total and split2_hand["total"] <= 21:
                        split2_hand["result"] = "win"
                    elif split2_hand["total"] == dealer_total and split2_hand["total"] <= 21:
                        split2_hand["result"] = "tie"
                    else:
                        split2_hand["result"] = "fail"
    await broadcast({
        "action": "game_evaluated",
        "game_state": serialize_game_state()
    })

async def handle_insurence(player_id, hand_index=0, split_level=0):
    """Set the 'insurence' property of the selected player's hand to 1"""
    if player_id not in game_state["players"]:
        await broadcast({"action": "error", "message": f"Invalid player ID: {player_id}"})
        return
    player = game_state["players"][player_id]
    hand = None
    if split_level == 1:
        if hand_index < len(player["split1"]):
            hand = player["split1"][hand_index]
    elif split_level == 2:
        if hand_index < len(player["split2"]):
            hand = player["split2"][hand_index]
    else:
        if hand_index < len(player["hands"]):
            hand = player["hands"][hand_index]
    if hand is not None:
        hand["insurence"] = 1
        await broadcast({
            "action": "insurance_taken",
            "player_id": player_id,
            "hand_index": hand_index,
            "split_level": split_level,
            "game_state": serialize_game_state()
        })
    else:
        await broadcast({"action": "error", "message": "Invalid hand index or split level for insurance"})

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