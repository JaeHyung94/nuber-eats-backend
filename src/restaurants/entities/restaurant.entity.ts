import { Field, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity()
export class Restaurant {
  @PrimaryGeneratedColumn()
  @Field(is => Number)
  id: number;

  @Field(is => String)
  @Column()
  @IsString()
  name: string;

  @Field(is => Boolean, { defaultValue: false })
  @Column({ default: false })
  @IsOptional()
  @IsBoolean()
  isVegan: boolean;

  @Field(is => String)
  @Column()
  @IsString()
  address: string;

  @Field(is => String)
  @Column()
  @IsString()
  ownerName: string;

  @Field(is => String)
  @Column()
  @IsString()
  categoryName: string;
}
