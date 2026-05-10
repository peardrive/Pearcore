CREATE TABLE `file_index` (
	`file_registry_id` integer NOT NULL,
	`root_hash` text NOT NULL,
	`level` integer NOT NULL,
	`hash` text NOT NULL,
	`parent_hash` text,
	`left_child_hash` text,
	`right_child_hash` text,
	`leaf_index` integer,
	PRIMARY KEY(`file_registry_id`, `root_hash`, `hash`),
	FOREIGN KEY (`file_registry_id`) REFERENCES `file_registry`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hash_index` ON `file_index` (`hash`);--> statement-breakpoint
CREATE INDEX `root_hash_index` ON `file_index` (`root_hash`);--> statement-breakpoint
CREATE TABLE `file_registry` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`timestamp` integer NOT NULL,
	`space_id` integer NOT NULL,
	`space_path` text NOT NULL,
	`space_filename` text NOT NULL,
	`root_hash` text,
	`leaf_count` integer NOT NULL,
	`height` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE TABLE `sharelinks` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_name` text NOT NULL,
	`public_key` text NOT NULL,
	`nonce` text NOT NULL,
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
	`nonce` text NOT NULL,
	`secret` text
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
