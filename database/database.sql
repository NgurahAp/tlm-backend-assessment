-- Lumiere Backend Assessment
-- PostgreSQL schema export
-- Target: an existing empty lumiere_ecommerce database

BEGIN;

CREATE TABLE orders (
    id SERIAL NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    subtotal NUMERIC(10,2) NOT NULL,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(10,2) NOT NULL,
    order_date TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_subtotal_nonnegative CHECK (subtotal >= 0),
    CONSTRAINT orders_discount_percentage_range
        CHECK (discount >= 0 AND discount <= 100),
    CONSTRAINT orders_grand_total_nonnegative CHECK (grand_total >= 0)
);

CREATE TABLE order_items (
    id SERIAL NOT NULL,
    order_id INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT order_items_pkey PRIMARY KEY (id),
    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_subtotal_nonnegative CHECK (subtotal >= 0)
);

CREATE TABLE payments (
    id SERIAL NOT NULL,
    order_id INTEGER NOT NULL,
    transaction_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'INQUIRY_PENDING',
    amount NUMERIC(10,2) NOT NULL,
    failure_code VARCHAR(60),
    failure_message VARCHAR(255),
    external_response JSONB,
    inquiry_at TIMESTAMP(6),
    paid_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payments_pkey PRIMARY KEY (id),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_transaction_id_nonempty
        CHECK (transaction_id IS NULL OR length(trim(transaction_id)) > 0)
);

CREATE UNIQUE INDEX orders_order_number_key ON orders(order_number);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE UNIQUE INDEX payments_order_id_key ON payments(order_id);
CREATE UNIQUE INDEX payments_transaction_id_key ON payments(transaction_id);
CREATE INDEX payments_status_idx ON payments(status);

ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE payments
    ADD CONSTRAINT payments_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

COMMIT;
