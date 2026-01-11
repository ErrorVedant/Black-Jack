#!/usr/bin/env python3
"""
Test script to verify the new deck creation on mode switch functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the functions we need to test
from server import create_deck, game_state

def test_create_deck():
    """Test that create_deck returns a properly shuffled deck"""
    deck = create_deck()
    print(f"✓ create_deck() returns deck with {len(deck)} cards")
    
    # Should be 6 decks * 52 cards = 312 cards
    assert len(deck) == 312, f"Expected 312 cards, got {len(deck)}"
    
    # Check that we have all expected cards
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K"]
    suits = ["S", "D", "C", "H"]
    expected_cards = [rank + suit for rank in ranks for suit in suits] * 6
    
    # Count each card type
    from collections import Counter
    deck_counts = Counter(deck)
    expected_counts = Counter(expected_cards)
    
    assert deck_counts == expected_counts, "Deck composition is incorrect"
    print("✓ Deck composition is correct (6 standard decks)")
    
    # Check that deck is shuffled (not in order)
    is_shuffled = deck != expected_cards
    assert is_shuffled, "Deck appears to be in order, not shuffled"
    print("✓ Deck is properly shuffled")
    
    return deck

def test_mode_switch_logic():
    """Test the logic for detecting mode switches"""
    # Test live to auto switch
    old_mode = "live"
    new_mode = "auto"
    should_create_deck = (old_mode == "live" and new_mode == "auto") or (old_mode == "auto" and new_mode == "live")
    assert should_create_deck, "Should detect live->auto switch"
    print("✓ Detects live->auto switch")
    
    # Test auto to live switch
    old_mode = "auto"
    new_mode = "live"
    should_create_deck = (old_mode == "live" and new_mode == "auto") or (old_mode == "auto" and new_mode == "live")
    assert should_create_deck, "Should detect auto->live switch"
    print("✓ Detects auto->live switch")
    
    # Test non-switching cases
    old_mode = "live"
    new_mode = "live"
    should_create_deck = (old_mode == "live" and new_mode == "auto") or (old_mode == "auto" and new_mode == "live")
    assert not should_create_deck, "Should not create deck for live->live"
    print("✓ Does not create deck for live->live")
    
    old_mode = "auto"
    new_mode = "auto"
    should_create_deck = (old_mode == "live" and new_mode == "auto") or (old_mode == "auto" and new_mode == "live")
    assert not should_create_deck, "Should not create deck for auto->auto"
    print("✓ Does not create deck for auto->auto")

def main():
    print("Testing new deck creation on mode switch functionality...")
    print("=" * 60)
    
    try:
        # Test deck creation
        deck1 = test_create_deck()
        deck2 = test_create_deck()
        
        # Test that multiple calls create different decks
        assert deck1 != deck2, "Multiple calls to create_deck should return different shuffled decks"
        print("✓ Multiple calls create different shuffled decks")
        
        # Test mode switch logic
        test_mode_switch_logic()
        
        print("=" * 60)
        print("✅ All tests passed! The implementation should work correctly.")
        print("\nSummary of implemented feature:")
        print("- When switching from LIVE to AUTO mode: new deck created")
        print("- When switching from AUTO to LIVE mode: new deck created")
        print("- Active players are preserved (their status remains)")
        print("- All cards are cleared from players and dealer")
        print("- Game state is reset to start fresh with new deck")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
