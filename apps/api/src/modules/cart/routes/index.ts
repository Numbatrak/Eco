import type { FastifyInstance } from "fastify";
import createCartRoutes from "./create.js";
import getCartRoutes from "./get.js";
import addCartItemRoutes from "./add-item.js";
import updateCartItemRoutes from "./update-item.js";
import removeCartItemRoutes from "./remove-item.js";

export default async function cartRoutes(app: FastifyInstance): Promise<void> {
  await app.register(createCartRoutes);
  await app.register(getCartRoutes);
  await app.register(addCartItemRoutes);
  await app.register(updateCartItemRoutes);
  await app.register(removeCartItemRoutes);
}
