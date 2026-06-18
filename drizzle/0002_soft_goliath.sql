CREATE TABLE `chat_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
