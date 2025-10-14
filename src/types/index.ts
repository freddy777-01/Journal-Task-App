export interface Entry {
	id?: number;
	title: string;
	content: string;
	date: string;
	mood?: string;
	tags?: string[];
	created_at?: string;
	updated_at?: string;
}

export interface Theme {
	mode: "light" | "dark" | "system";
}

export interface Settings {
	theme: Theme;
	autoSave: boolean;
	fontSize: number;
	fontFamily: string;
}
