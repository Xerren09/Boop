import { useContext } from "react";
import { ProjectProvider, RemoteProcess } from "../../api/api";
import Section from "../../components/section";
import { Link, Text } from "@fluentui/react-components";
import type { ProjectStatus } from "../../api/streamers/types";
import Stack from "../../components/stack";
import RemoteProcessGroup from "../../components/processGroup";
import { ProjectStatusIcon } from "../../components/project/statusIcon";

const statusHeadingMap: { [key in NonNullable<ProjectStatus>]: string } = {
    "deployed": "Project deployed",
    "installing": "Installing",
    "installFailed": "Installer failed",
    "installSuccess": "Installer complete",
    "stopped": "Project stopped",
    "error": "Project error"
}

export default function ProjectDeployTab(props: { status: ProjectStatus, process?: RemoteProcess | null, directUrlHref?: string }) {
    const project = useContext(ProjectProvider);

    if (!props.status || !project) {
        return null;
    }

    const proxyUrl = project.proxyUrl.toString();

    return (
        <Stack horizontalFill gap={24}>
            <Section
                title={statusHeadingMap[props.status]}
                icon={<ProjectStatusIcon status={props.status}/>}
            >
                {
                    props.status === "deployed" &&
                    <Text>
                        This project is currently deployed. You can access it via Boop's HTTP proxy at <Link href={proxyUrl}> {proxyUrl} </Link>{ props.directUrlHref && <Text> or directly at <Link href={props.directUrlHref}> {props.directUrlHref} </Link></Text> }.
                    </Text>
                }
                {
                    props.status === "stopped" &&
                    <Text>
                        This project is currently stopped, and unavailable for other services. To deploy the project, click <em>Start</em>.
                    </Text>
                }
                {
                    props.status === "error" &&
                    <Text>
                            This project is currently stopped due to an error.
                            {
                                props.process &&
                                "Check the terminal window below to see what went wrong, or the <em>log</em> tab for further information."
                            }
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
                props.process ? <RemoteProcessGroup title="Service" processes={[props.process]}/> : null
            }
        </Stack>    
    );
}