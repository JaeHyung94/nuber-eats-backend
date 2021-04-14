import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver, Query, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { AuthUser } from 'src/auth/auth-user.decorator';
import { Role } from 'src/auth/role.decorator';
import {
  NEW_COOKED_ORDER,
  NEW_ORDER_UPDATE,
  NEW_PENDING_ORDER,
  PUB_SUB,
} from 'src/common/common.constants';
import { User } from 'src/users/entities/user.entitiy';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { EditOrderInput, EditOrderOutput } from './dtos/edit-order.dto';
import { GetOrderInput, GetOrderOutput } from './dtos/get-order.dto';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { OrderUpdatesInput } from './dtos/order-updates.dto';
import { TakeOrderInput, TakeOrderOutput } from './dtos/take-order.dto';
import { Order } from './entities/order.entity';
import { OrderService } from './orders.service';

// Pubsub은 전체 application에 하나만 있어야, 마치 Database가 하나만 있는 것 처럼
// const pubsub = new PubSub();

@Resolver(of => Order)
export class OrderResolver {
  constructor(
    private readonly orderService: OrderService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Mutation(returns => CreateOrderOutput)
  @Role(['Client'])
  async createOrder(
    @AuthUser() customer: User,
    @Args('input') createOrderInput: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    return this.orderService.createOrder(customer, createOrderInput);
  }

  @Query(returns => GetOrdersOutput)
  @Role(['Any'])
  async getOrders(
    @AuthUser() user: User,
    @Args('input') getOrdersInput: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    return this.orderService.getOrders(user, getOrdersInput);
  }

  @Query(returns => GetOrderOutput)
  @Role(['Any'])
  async getOrder(
    @AuthUser() user: User,
    @Args('input') getOrderInput: GetOrderInput,
  ): Promise<GetOrderOutput> {
    return this.orderService.getOrder(user, getOrderInput);
  }

  @Mutation(returns => EditOrderOutput)
  @Role(['Owner', 'Delivery'])
  async editOrder(
    @AuthUser() user: User,
    @Args('input') editOrderInput: EditOrderInput,
  ): Promise<EditOrderOutput> {
    return this.orderService.editOrder(user, editOrderInput);
  }

  @Subscription(returns => Order, {
    filter: ({ pendingOrders: { ownerId } }, _, { user }) => {
      return ownerId === user.id;
    },
    resolve: ({ pendingOrders: { order } }) => order,
  })
  @Role(['Owner'])
  async pendingOrders() {
    return this.pubSub.asyncIterator(NEW_PENDING_ORDER);
  }

  @Subscription(returns => Order)
  @Role(['Delivery'])
  async cookedOrders() {
    return this.pubSub.asyncIterator(NEW_COOKED_ORDER);
  }

  @Subscription(returns => Order, {
    filter: (
      { orderUpdates: order }: { orderUpdates: Order },
      { input }: { input: OrderUpdatesInput },
      { user }: { user: User },
    ) => {
      if (
        order.customerId !== user.id &&
        order.deliverId !== user.id &&
        order.restaurant.ownerId !== user.id
      ) {
        return false;
      }
      return order.id === input.id;
    },
  })
  @Role(['Any'])
  async orderUpdates(@Args('input') orderUpdatesInput: OrderUpdatesInput) {
    return this.pubSub.asyncIterator(NEW_ORDER_UPDATE);
  }

  @Mutation(returns => TakeOrderOutput)
  @Role(['Delivery'])
  async takeOrder(
    @AuthUser() deliver: User,
    @Args('input') takeOrderInput: TakeOrderInput,
  ): Promise<TakeOrderOutput> {
    return this.orderService.takeOrder(deliver, takeOrderInput);
  }
}

//Subscription Filter를 위한 예제 Filter로 조건을 걸고 Resolve로 보여줄 방식을 정할 수 있음.
// @Mutation(returns => Boolean)
// async potatoReady(@Args('potatoId') potatoId: number) {
//   await this.pubSub.publish('hotPotatos', {
//     readyPotato: potatoId,
//   });
//   return true;
// }

// @Subscription(returns => String, {
//   filter: ({ readyPotato }, { potatoId }) => {
//     return readyPotato === potatoId;
//   },
//   resolve: ({ readyPotato }) => {
//     return `Your potato with id ${readyPotato} is ready!`;
//   },
// })
// @Role(['Any'])
// readyPotato(@Args('potatoId') potatoId: number) {
//   return this.pubSub.asyncIterator('hotPotatos');
// }

// Subscription의 간단한 예제
// @Mutation(returns => Boolean)
// potatoReady() {
//   this.pubSub.publish('hotPotatos', {
//     orderSubscription: 'Your Potato is Ready',
//   });
//   return true;
// }

// @Subscription(returns => String)
// @Role(['Any'])
// orderSubscription(@AuthUser() user: User) {
//   console.log(user);
//   return this.pubSub.asyncIterator('hotPotatos');
// }
