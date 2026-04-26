PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_spaces` (
	`id` integer PRIMARY KEY NOT NULL,
	`space_name` text NOT NULL,
	`public_key` text NOT NULL,
	`timestamp` integer NOT NULL,
	`permission_broadcast` integer NOT NULL,
	`permission_read` integer NOT NULL,
	`signature` text NOT NULL,
	`nonce` integer NOT NULL,
	`secret` text
);
--> statement-breakpoint
INSERT INTO `__new_spaces`("id", "space_name", "public_key", "timestamp", "permission_broadcast", "permission_read", "signature", "nonce", "secret") SELECT "id", "space_name", "public_key", "timestamp", "permission_broadcast", "permission_read", "signature", "nonce", "secret" FROM `spaces`;--> statement-breakpoint
DROP TABLE `spaces`;--> statement-breakpoint
ALTER TABLE `__new_spaces` RENAME TO `spaces`;--> statement-breakpoint
PRAGMA foreign_keys=ON;