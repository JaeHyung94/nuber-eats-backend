import { InputType, PickType } from '@nestjs/graphql';
import { Order, OrderStatus } from '../entities/order.entity';

@InputType()
export class OrderUpdatesInput extends PickType(Order, ['id']) {}
