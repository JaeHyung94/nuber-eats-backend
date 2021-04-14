import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtMiddleware } from 'src/jwt/jwt.middleware';
import { JwtModule } from 'src/jwt/jwt.module';
import { JwtService } from 'src/jwt/jwt.service';
import { User } from './entities/user.entitiy';
import { Verification } from './entities/verification.entitiy';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Verification])],
  providers: [UsersService, UsersResolver, JwtModule],
  exports: [UsersService],
})
export class UsersModule {}
