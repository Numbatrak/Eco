ALTER TABLE "products" ADD COLUMN "numbatrak_product_id" uuid;--> statement-breakpoint
ALTER TABLE "numbatrak_products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_numbatrak_product_id_numbatrak_products_id_fk" FOREIGN KEY ("numbatrak_product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_numbatrak_product_idx" ON "products" USING btree ("numbatrak_product_id");