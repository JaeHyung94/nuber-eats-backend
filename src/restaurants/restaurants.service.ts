import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entitiy';
import { Like, Raw, Repository } from 'typeorm';
import {
  CreateRestaurantInput,
  CreateRestaurantOutput,
} from './dtos/create-restaurant.dto';
import { Category } from './entities/category.entity';
import { Restaurant } from './entities/restaurant.entity';
import {
  EditRestaurantInput,
  EditRestaurantOutput,
} from './dtos/edit-retaurant.dto';
import { CategoryRepository } from './repositories/category.repository';
import {
  DeleteRestaurantInput,
  DeleteRestaurantOutput,
} from './dtos/delete-restaurant.dto';
import { AllCategoriesOutput } from './dtos/all-categories.dto';
import { CategoryInput, CategoryOutput } from './dtos/category.dto';
import { RestaurantsInput, RestaurantsOutput } from './dtos/restaurants.dto';
import { RestaurantInput, RestaurantOutput } from './dtos/restaurant.dto';
import {
  SearchRestaurantInput,
  SearchRestaurantOutput,
} from './dtos/search-restaurant.dto';
import { CreateDishInput, CreateDishOutput } from './dtos/create-dish.dto';
import { Dish } from './entities/dish.entity';
import { DeleteDishInput, DeleteDishOutput } from './dtos/delete-dish.dto';
import { EditDishInput, EditDishOutput } from './dtos/edit-dish.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly category: CategoryRepository,
    @InjectRepository(Dish) private readonly dishes: Repository<Dish>,
  ) {}

  async createRestaurant(
    owner: User,
    createRestaurantInput: CreateRestaurantInput,
  ): Promise<CreateRestaurantOutput> {
    try {
      const newRestaurant = this.restaurants.create(createRestaurantInput);
      newRestaurant.owner = owner;

      const category = await this.category.getOrCreate(
        createRestaurantInput.categoryName,
      );

      newRestaurant.category = category;

      await this.restaurants.save(newRestaurant);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Could not create restaurant',
      };
    }
  }

  async eidtRestaurant(
    owner: User,
    editRestaurantInput: EditRestaurantInput,
  ): Promise<EditRestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        editRestaurantInput.restaurantId,
      );

      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant Not Found',
        };
      }

      if (owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          error: 'You Cannot Edit Restaurant Information',
        };
      }
      let category: Category = null;
      if (editRestaurantInput.categoryName) {
        category = await this.category.getOrCreate(
          editRestaurantInput.categoryName,
        );
      }
      await this.restaurants.save([
        {
          id: editRestaurantInput.restaurantId,
          ...editRestaurantInput,
          ...(category && { category }),
        },
      ]);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Edit Restaurant Information',
      };
    }
  }

  async deleteRestaurant(
    owner: User,
    deleteRestaurantInput: DeleteRestaurantInput,
  ): Promise<DeleteRestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        deleteRestaurantInput.restaurantId,
      );

      if (!restaurant) {
        return {
          ok: false,
          error: 'Cannot Found Restaurant',
        };
      }

      if (owner.id !== restaurant.ownerId) {
        return {
          ok: false,
          error: "You cannot delete someone else's restaurant",
        };
      }

      await this.restaurants.delete(deleteRestaurantInput.restaurantId);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Delete Restaurant',
      };
    }
  }

  async allCategories(): Promise<AllCategoriesOutput> {
    try {
      const categories = await this.category.find();
      return {
        ok: true,
        categories,
      };
    } catch {
      return {
        ok: false,
        error: 'Could not load categories',
      };
    }
  }

  countRestaurant(category: Category): Promise<number> {
    return this.restaurants.count({ category });
  }

  async findCategoryBySlug({
    slug,
    page,
  }: CategoryInput): Promise<CategoryOutput> {
    try {
      const category = await this.category.findOne({ slug });

      if (!category) {
        return {
          ok: false,
          error: 'Category Not Found',
        };
      }

      const restaurants = await this.restaurants.find({
        where: {
          category,
        },
        take: 3,
        skip: (page - 1) * 3,
      });
      category.restaurants = restaurants;
      const totalResults = await this.countRestaurant(category);
      return {
        ok: true,
        category,
        totalPages: Math.ceil(totalResults / 3),
        totalResults,
        restaurants,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Find Category by Slug',
      };
    }
  }

  async allRestaurants({ page }: RestaurantsInput): Promise<RestaurantsOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        skip: (page - 1) * 3,
        take: 3,
        order: {
          isPromoted: 'DESC',
        },
        relations: ['category'],
      });

      return {
        ok: true,
        results: restaurants,
        totalPages: Math.ceil(totalResults / 3),
        totalResults,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Find All Restaurants',
      };
    }
  }

  async findRestaurantById(
    restaurantInput: RestaurantInput,
  ): Promise<RestaurantOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        restaurantInput.restaurantId,
        {
          relations: ['menu', 'owner', 'category'],
        },
      );

      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant Not Found',
        };
      }

      return {
        ok: true,
        restaurant,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Get Restaurant Information',
      };
    }
  }

  async searchRestaurantByName({
    query,
    page,
  }: SearchRestaurantInput): Promise<SearchRestaurantOutput> {
    try {
      const [restaurants, totalResults] = await this.restaurants.findAndCount({
        where: {
          // name: Like(`%${query}%`), : 대소문자를 구분함. 대소문자 구분 안하는 ILIKE는 아직 TypeORM이 정식 지원을 안함.
          name: Raw(name => `${name} ILIKE '%${query}%'`),
        },
        skip: (page - 1) * 3,
        take: 3,
        order: {
          isPromoted: 'DESC',
        },
        relations: ['category'],
      });

      return {
        ok: true,
        totalPages: Math.ceil(totalResults / 3),
        totalResults,
        restaurants,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Search Results are Not Found',
      };
    }
  }

  async createDish(
    owner: User,
    createDishInput: CreateDishInput,
  ): Promise<CreateDishOutput> {
    try {
      const restaurant = await this.restaurants.findOne(
        createDishInput.restaurantId,
      );

      if (!restaurant) {
        return {
          ok: false,
          error: 'Restaurant Not Found',
        };
      }

      if (restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: "You cannot Create Menus for Someone Else's Restaurant",
        };
      }

      await this.dishes.save(
        this.dishes.create({ ...createDishInput, restaurant }),
      );

      console.log(await this.dishes.findOne());

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Create Dish',
      };
    }
  }

  async deleteDish(
    owner: User,
    { dishId }: DeleteDishInput,
  ): Promise<DeleteDishOutput> {
    try {
      const dish = await this.dishes.findOne(dishId, {
        relations: ['restaurant'],
      });

      if (!dish) {
        return {
          ok: false,
          error: 'Dish Not Found',
        };
      }

      if (dish.restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: "Cannot Delete Someone Else's Dish",
        };
      }

      await this.dishes.delete(dishId);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Delete Dish Information',
      };
    }
  }

  async editDish(
    owner: User,
    editDishInput: EditDishInput,
  ): Promise<EditDishOutput> {
    try {
      const dish = await this.dishes.findOne(editDishInput.dishId, {
        relations: ['restaurant'],
      });

      if (!dish) {
        return {
          ok: false,
          error: 'Dish Not Found',
        };
      }

      if (dish.restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: "Cannot Edit Someone Else's Dish Information",
        };
      }

      await this.dishes.save([
        {
          id: editDishInput.dishId,
          ...editDishInput,
        },
      ]);
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: 'Cannot Edit Dish Information',
      };
    }
  }
}
