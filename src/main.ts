import { getInput, setFailed } from "@actions/core";
import { getKustomize } from "./installer";

async function run(): Promise<void> {
	try {
		//
		// Version is optional. If supplied, install / use from the tool cache
		// If not supplied then task is still used to setup proxy, auth, etc...
		//
		const version = getInput("kustomize-version");

		if (version) {
			await getKustomize(version);
		}
	} catch (error) {
		setFailed(`${error}`);
	}
}

run();
