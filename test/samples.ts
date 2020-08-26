import { ActorRef } from '../src';

describe('samples', () => {
  it('cqrs', done => {
    interface ShoppingCartState {
      isCheckedOut: boolean;
      hasItem: (itemId: string) => boolean;
      isEmpty: boolean;
      updateItem: (itemId: string, quantity: number) => ShoppingCartState;
      removeItem: (itemId: string) => ShoppingCartState;
      checkout: () => ShoppingCartState;
    }

    const createShoppingCartState = (
      items: Map<string, number>,
      checkoutDate?: number
    ): ShoppingCartState => {
      const state: ShoppingCartState = {
        isCheckedOut: checkoutDate !== undefined,
        hasItem: (itemId: string): boolean => {
          return items.has(itemId);
        },
        isEmpty: items.size === 0,
        updateItem: (itemId: string, quantity: number) => {
          if (quantity === 0) {
            items.delete(itemId);
            return state;
          } else {
            items.set(itemId, quantity);
            return state;
          }
        },
        removeItem: (itemId: string) => {
          items.delete(itemId);
          return state;
        },
        checkout: () => {
          return { ...state, checkoutDate: Date.now() };
        },
        // toSummary
      };

      return state;
    };

    // final case class AddItem(itemId: String, quantity: Int, replyTo: ActorRef[StatusReply[Summary]]) extends Command
    interface AddItemEvent {
      type: 'AddItem';
      itemId: string;
      quantity: number;
      replyTo: ActorRef<any>;
    }

    // final case class RemoveItem(itemId: String, replyTo: ActorRef[StatusReply[Summary]]) extends Command
    interface RemoveItemEvent {
      type: 'RemoveItem';
      itemId: string;
      replyTo: ActorRef<any>;
    }

    // final case class AdjustItemQuantity(itemId: String, quantity: Int, replyTo: ActorRef[StatusReply[Summary]])
    interface AdjustItemQuantityEvent {
      type: 'AdjustItemQuantity';
      itemId: string;
      quantity: number;
      replyTo: ActorRef<any>;
    }

    interface CheckoutEvent {
      type: 'Checkout';
      replyTo: ActorRef<any>;
    }

    interface GetEvent {
      type: 'Get';
      replyTo: ActorRef<any>;
    }

    const openShoppingCart = (
      cartId: string,
      state: ShoppingCartState,
      command: AddItemEvent
    ) => {
      switch (command.type) {
        case 'AddItem':
          if (state.hasItem(command.itemId)) {
          }
      }
    };

    // private def openShoppingCart(cartId: String, state: State, command: Command): ReplyEffect[Event, State] =
    // command match {
    //   case AddItem(itemId, quantity, replyTo) =>
    //     if (state.hasItem(itemId))
    //       Effect.reply(replyTo)(StatusReply.Error(s"Item '$itemId' was already added to this shopping cart"))
    //     else if (quantity <= 0)
    //       Effect.reply(replyTo)(StatusReply.Error("Quantity must be greater than zero"))
    //     else
    //       Effect
    //         .persist(ItemAdded(cartId, itemId, quantity))
    //         .thenReply(replyTo)(updatedCart => StatusReply.Success(updatedCart.toSummary))

    //   case RemoveItem(itemId, replyTo) =>
    //     if (state.hasItem(itemId))
    //       Effect
    //         .persist(ItemRemoved(cartId, itemId))
    //         .thenReply(replyTo)(updatedCart => StatusReply.Success(updatedCart.toSummary))
    //     else
    //       Effect.reply(replyTo)(StatusReply.Success(state.toSummary)) // removing an item is idempotent

    //   case AdjustItemQuantity(itemId, quantity, replyTo) =>
    //     if (quantity <= 0)
    //       Effect.reply(replyTo)(StatusReply.Error("Quantity must be greater than zero"))
    //     else if (state.hasItem(itemId))
    //       Effect
    //         .persist(ItemQuantityAdjusted(cartId, itemId, quantity))
    //         .thenReply(replyTo)(updatedCart => StatusReply.Success(updatedCart.toSummary))
    //     else
    //       Effect.reply(replyTo)(
    //         StatusReply.Error(s"Cannot adjust quantity for item '$itemId'. Item not present on cart"))

    //   case Checkout(replyTo) =>
    //     if (state.isEmpty)
    //       Effect.reply(replyTo)(StatusReply.Error("Cannot checkout an empty shopping cart"))
    //     else
    //       Effect
    //         .persist(CheckedOut(cartId, Instant.now()))
    //         .thenReply(replyTo)(updatedCart => StatusReply.Success(updatedCart.toSummary))

    //   case Get(replyTo) =>
    //     Effect.reply(replyTo)(state.toSummary)
    // }

    // private def checkedOutShoppingCart(cartId: String, state: State, command: Command): ReplyEffect[Event, State] =
    //   command match {
    //     case Get(replyTo) =>
    //       Effect.reply(replyTo)(state.toSummary)
    //     case cmd: AddItem =>
    //       Effect.reply(cmd.replyTo)(StatusReply.Error("Can't add an item to an already checked out shopping cart"))
    //     case cmd: RemoveItem =>
    //       Effect.reply(cmd.replyTo)(StatusReply.Error("Can't remove an item from an already checked out shopping cart"))
    //     case cmd: AdjustItemQuantity =>
    //       Effect.reply(cmd.replyTo)(StatusReply.Error("Can't adjust item on an already checked out shopping cart"))
    //     case cmd: Checkout =>
    //       Effect.reply(cmd.replyTo)(StatusReply.Error("Can't checkout already checked out shopping cart"))
    //   }

    // private def handleEvent(state: State, event: Event) = {
    //   event match {
    //     case ItemAdded(_, itemId, quantity)            => state.updateItem(itemId, quantity)
    //     case ItemRemoved(_, itemId)                    => state.removeItem(itemId)
    //     case ItemQuantityAdjusted(_, itemId, quantity) => state.updateItem(itemId, quantity)
    //     case CheckedOut(_, eventTime)                  => state.checkout(eventTime)
    //   }
    // }

    // const openShoppingCart = ()
  });
});
