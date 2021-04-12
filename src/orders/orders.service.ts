import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Dish, DishOption } from 'src/restaurants/entities/dish.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User, UserRole } from 'src/users/entities/user.entitiy';
import { Repository } from 'typeorm';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { EditOrderInput, EditOrderOutput } from './dtos/edit-order.dto';
import { GetOrderInput, GetOrderOutput } from './dtos/get-order.dto';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishes: Repository<Dish>,
  ) {}

  async createOrder(
    customer: User,
    { restaurantId, items }: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);

      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant Not Found',
        };
      }

      let orderFinalPrice = 0;
      const orderItems: OrderItem[] = [];

      for (const item of items) {
        const dish = await this.dishes.findOne(item.dishId);

        if (!dish) {
          return {
            ok: false,
            error: 'Dish Not Found',
          };
        }
        let dishFinalPrice = dish.price;
        console.log(`Dish Price: $USD ${dish.price}`);
        for (const itemOption of item.options) {
          console.log(itemOption.name);
          const dishOption = dish.options.find(
            dishOption => dishOption.name === itemOption.name,
          );

          if (dishOption.extra) {
            dishFinalPrice = dishFinalPrice + dishOption.extra;
            console.log(`$USD + ${dishOption.extra}`);
          } else {
            const dishOptionChoice = dishOption.choices.find(
              choice => choice.name === itemOption.choice,
            );
            if (dishOptionChoice) {
              if (dishOptionChoice.extra) {
                dishFinalPrice = dishFinalPrice + dishOptionChoice.extra;
                console.log(`$USD + ${dishOptionChoice.extra}`);
              }
            }
          }
        }

        orderFinalPrice = orderFinalPrice + dishFinalPrice;
        console.log(orderFinalPrice);

        const orderItem = await this.orderItems.save(
          this.orderItems.create({
            dish,
            options: item.options,
          }),
        );

        orderItems.push(orderItem);
      }

      await this.orders.save(
        this.orders.create({
          total: orderFinalPrice,
          customer,
          restaurant,
          items: orderItems,
        }),
      );

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Creating Order',
      };
    }
  }

  async getOrders(
    user: User,
    { status }: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    try {
      let orders: Order[];
      if (user.role === UserRole.Client) {
        orders = await this.orders.find({
          where: {
            customer: user,
          },
        });
      } else if (user.role === UserRole.Owner) {
        const restaurants = await this.restaurants.find({
          where: {
            owner: user,
          },
          relations: ['orders'],
        });
        orders = restaurants.map(restaurant => restaurant.orders).flat(1);
      } else if (user.role === UserRole.Delivery) {
        orders = await this.orders.find({
          where: {
            deliver: user,
          },
        });
      }

      if (status) {
        orders = orders.filter(order => order.status === status);
      }

      return {
        ok: true,
        orders,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Get Order Information',
      };
    }
  }

  checkId(user: User, order: Order): boolean {
    let allowed = true;
    if (user.role === UserRole.Client && user.id !== order.customerId) {
      allowed = false;
    }
    if (user.role === UserRole.Delivery && user.id !== order.deliverId) {
      allowed = false;
    }
    if (user.role === UserRole.Owner && user.id !== order.restaurant.ownerId) {
      allowed = false;
    }

    return allowed;
  }

  async getOrder(
    user: User,
    { id: orderId }: GetOrderInput,
  ): Promise<GetOrderOutput> {
    try {
      const order = await this.orders.findOne(orderId, {
        relations: ['restaurant'],
      });

      if (!order) {
        return {
          ok: false,
          error: 'Order Not Found',
        };
      }

      if (!this.checkId(user, order)) {
        return {
          ok: false,
          error: "You Cannot Someone Else's Order Information",
        };
      }

      return {
        ok: true,
        order: order,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Get Order Information',
      };
    }
  }

  async editOrder(
    user: User,
    { id: orderId, status }: EditOrderInput,
  ): Promise<EditOrderOutput> {
    try {
      const order = await this.orders.findOne(orderId, {
        relations: ['restaurant'],
      });

      if (!order) {
        return {
          ok: false,
          error: 'Order Not Found',
        };
      }

      if (!this.checkId(user, order)) {
        return {
          ok: false,
          error: "You Cannot Edit Someone Else's Order",
        };
      }

      if (user.role === UserRole.Owner) {
        if (
          status !== OrderStatus.Cooking &&
          status !== OrderStatus.Cooked &&
          status !== OrderStatus.Cancelled
        ) {
          return {
            ok: false,
            error: 'Owners Can Change Cooking, Cooked, or Cancelled',
          };
        }
      }

      if (user.role === UserRole.Delivery) {
        if (
          status !== OrderStatus.PickedUp &&
          status !== OrderStatus.Delivered
        ) {
          return {
            ok: false,
            error: 'Delivers Can Change Picked Up or Delivered',
          };
        }
      }

      await this.orders.save([
        {
          id: orderId,
          status,
        },
      ]);

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Could Not Update Order Information',
      };
    }
  }
}
