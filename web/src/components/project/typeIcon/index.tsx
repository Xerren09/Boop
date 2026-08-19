import { AppGenericFilled, AppGenericRegular, WindowConsoleFilled, WindowConsoleRegular } from "@fluentui/react-icons"
import type { ProjectType } from "../../../api/api"

export function ProjectIcon(props: Props) {
    const size = props.size ?? 18;

    return (
        props.filled ? 
            props.type == "webapp" ? <AppGenericFilled fontSize={size}/> : <WindowConsoleFilled fontSize={size}/>
            :  
            props.type == "webapp" ? <AppGenericRegular fontSize={size}/> : <WindowConsoleRegular fontSize={size}/>
    )
}

type Props = {
    type: ProjectType,
    size?: number,
    filled?: boolean
}