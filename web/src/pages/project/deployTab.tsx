import { useContext } from "react";
import { ProjectProvider, RemoteProcess } from "../../api/api";
import Section from "../../components/section";
import { Link, Text } from "@fluentui/react-components";
import type { ProjectStatus } from "../../api/streamers/types";
import Stack from "../../components/stack";
import RemoteProcessGroup from "../../components/processGroup";

const statusHeadingMap: { [key in NonNullable<ProjectStatus>]: string } = {
    "deployed": "Project deployed",
    "installing": "Installing",
    "installFailed": "Installer failed",
    "installSuccess": "Installer complete",
    "stopped": "Project stopped"
}

export default function ProjectDeployTab(props: { status: ProjectStatus, process?: RemoteProcess | null }) {
    const project = useContext(ProjectProvider);

    if (!props.status || !project) {
        return null;
    }

    const proxyUrl = project.proxyUrl.toString();

    return (
        <Stack horizontalFill gap={24}>
            <Section
                title={ statusHeadingMap[props.status] }
            >
                {
                    props.status === "deployed" &&
                    <Text>
                        This project is currently deployed. You can access it via BOOP's proxy at <Link href={proxyUrl}> { proxyUrl } </Link> or directly at --link--.
                    </Text>
                }
                {
                    props.status === "stopped" &&
                    <Text>
                        This project is currently stopped. This may be intentional, or due to an error. Check that the installer completed successfully, or in the case of a service project, check the main process' output.
                    </Text>
                }
                {
                    props.status === "installing" &&
                    <Text>
                        This project is currently installing. You can follow the progress using the <em>installer</em> tab. Once the installer completed, it will be automatically deployed if successful.
                    </Text>
                }
                {
                    props.status === "installFailed" &&
                    <Text>
                        The project installer has failed. This means your build is failing. Typically you can fix it by pushing a commit to the target branch of your repository.
                
                        Check the <em>installer</em> tab to see what went wrong.
                    </Text>
                }
                {
                    props.status === "installSuccess" &&
                    <Text>
                        This project has just been installed, and will be deployed momentarily. Check the install log via the <em>installer</em> tab, or stay here to wait for deployment information.
                    </Text>
                }            
            </Section>
            {
                props.process ? <RemoteProcessGroup title="Deploy" processes={[props.process]}/> : null
            }
        </Stack>    
    );
}