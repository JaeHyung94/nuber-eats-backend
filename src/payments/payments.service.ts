import { Injectable } from '@nestjs/common';
import { Cron, Interval, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { User } from 'src/users/entities/user.entitiy';
import { LessThan, Repository } from 'typeorm';
import {
  CreatePaymentInput,
  CreatePaymentOutput,
} from './dtos/create-payment.dto';
import { GetPaymentsOutput } from './dtos/get-payments.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async createPayment(
    owner: User,
    { transactionId, restaurantId }: CreatePaymentInput,
  ): Promise<CreatePaymentOutput> {
    try {
      const restaurant = await this.restaurants.findOne(restaurantId);

      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant Not Found',
        };
      }

      if (restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error:
            "You Cannot Edit Payment Information of Someone Else's Restaurant",
        };
      }

      await this.payments.save(
        this.payments.create({
          transactionId,
          user: owner,
          restaurant,
        }),
      );

      restaurant.isPromoted = true;
      const date = new Date();
      date.setDate(date.getDate() + 7);
      restaurant.promotedUntil = date;

      await this.restaurants.save(restaurant);

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Create Payment',
      };
    }
  }

  async getPayments(owner: User): Promise<GetPaymentsOutput> {
    try {
      const payments = await this.payments.find({ user: owner });

      if (!payments) {
        return {
          ok: false,
          error: 'Payments Not Found',
        };
      }

      return {
        ok: true,
        payments,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Get Payments Information',
      };
    }
  }

  @Cron('0 0 0 * * *')
  async checkPromotedRestaurants() {
    const restaurants = await this.restaurants.find({
      isPromoted: true,
      promotedUntil: LessThan(new Date()),
    });
    console.log(restaurants);
    restaurants.forEach(async restaurant => {
      (restaurant.isPromoted = false), (restaurant.promotedUntil = null);

      await this.restaurants.save(restaurant);
    });
  }
}

// CronJob & Interval & Timeout 예제
// @Cron('30 * * * * *')
// checkForPayments() {
//   console.log('Checking for payments...(cron)');
// }

// @Interval(30000)
// checkForInterval() {
//   console.log('Checking for payments...(interval)');
// }

// @Cron('30 * * * * *', {
//   name: 'myJob',
// })
// checkForPayments() {
//   console.log('Checking for payments...');
//   const job = this.schedulerRegistry.getCronJob('myJob');
//   console.log(job);
// }
