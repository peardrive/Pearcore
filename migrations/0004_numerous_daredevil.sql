CREATE TABLE `sharelinks` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_name` text NOT NULL,
	`public_key` text NOT NULL,
	`nonce` text NOT NULL
);
