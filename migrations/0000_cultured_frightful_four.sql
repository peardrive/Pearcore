CREATE TABLE `messages` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`topic` text NOT NULL,
	`is_relay` integer NOT NULL,
	`sender_public_key` text NOT NULL,
	`broadcast_timestamp` integer NOT NULL,
	`timestamp` integer NOT NULL,
	`nonce` text NOT NULL,
	`message_owner_public_key` text NOT NULL,
	`signature` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_nonce_unique` ON `messages` (`nonce`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`tag` text DEFAULT '' NOT NULL,
	`profile_url` text DEFAULT '',
	`public_key` text NOT NULL,
	`signature` text NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broadcast_whitelist` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_id` integer NOT NULL,
	`allowed_public_key` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `read_whitelist` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_id` integer NOT NULL,
	`allowed_public_key` text NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `spaces` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_name` text NOT NULL,
	`public_key` text NOT NULL,
	`timestamp` integer NOT NULL,
	`permission_broadcast` integer NOT NULL,
	`permission_read` integer NOT NULL,
	`signature` text NOT NULL,
	`nonce` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `space_members` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_id` integer NOT NULL,
	`user_profile_id` integer NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_profile_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
