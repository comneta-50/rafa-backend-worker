/**
 * Types & Clean Initial State for Rafa Company AI Platform
 */

export interface Agent {
	name: string;
	role: string;
	status: "Online" | "Busy" | "Offline";
	activeJobs: number;
	efficiency: string;
	avatar: string;
}

export interface Job {
	id: string;
	orderId?: string;
	repo: string;
	branch: string;
	title: string;
	agent: string;
	status: "fixing" | "testing" | "review" | "completed" | "failed";
	statusLabel: string;
	time: string;
	progress: number | string;
	logs?: string[];
	diff?: string;
}

export interface LifecycleOrder {
	id: string;
	clientName: string;
	clientEmail: string;
	packageType: string;
	feeAmount: string;
	bugDescription: string;
	repoUrl: string;
	branchName: string;
	status: "order_created" | "repo_connected" | "ai_fixing" | "client_review" | "job_closed";
	aiStage?: "Analyzer" | "Approval" | "Developer" | "QA" | "Ready";
	retentionExpires: string;
	prUrl?: string;
	zipDownloaded?: boolean;
	workspaceDestroyed?: boolean;
}

export interface ReviewItem {
	id: string;
	title: string;
	repo: string;
	branch: string;
	author: string;
	risk: string;
	filesChanged: number;
	additions: number;
	deletions: number;
	summary: string;
	time: string;
}

export interface RepoItem {
	name: string;
	description: string;
	stars: number;
	defaultBranch: string;
	syncedAt: string;
	status: string;
	autoFix: boolean;
}

export interface ActivityLog {
	id: string;
	timestamp: string;
	level: "success" | "info" | "warn" | "failed";
	agent: string;
	repo: string;
	message: string;
	duration?: string;
}

// Data kosong tanpa mock dummy
export const initialAgents: Agent[] = [];
export const initialJobs: Job[] = [];
export const initialOrders: LifecycleOrder[] = [];
export const initialReviews: ReviewItem[] = [];
export const initialRepos: RepoItem[] = [];
export const initialActivityLogs: ActivityLog[] = [];
