import { Spinner, Tooltip, type SpinnerProps } from "@fluentui/react-components";
import { CheckmarkCircleColor, DismissCircleColor, ErrorCircleColor, FlashFilled, PauseFilled, WarningColor } from "@fluentui/react-icons";

export default function StatusIcon(props: StatusIconProps) {

    const size = matchSizeToFont(props.size ?? "small");

    function getIcon() {
        switch (props.status) {
            case "ok":
                return <CheckmarkCircleColor fontSize={size} />          
            case "error":
                return <DismissCircleColor fontSize={size} />
            case "warning":
                return <WarningColor fontSize={size} />
            case "paused":
                return <PauseFilled fontSize={size} primaryFill="orange" />
            case "killed":
                return <FlashFilled fontSize={size} primaryFill="orange"/>
            case "pending":
            default:
                return <Spinner size={ props.size ?? "small" }></Spinner>
        }
    }

    return (
        <div style={{ display: "flex" }}>
            <Tooltip content={props.status ?? "pending"} relationship="description">
                {
                    getIcon()
                }
            </Tooltip>
        </div>
    );
}

export type Status = "ok" | "error" | "warning" | "pending" | "paused" | "killed" | undefined;

export type StatusIconProps = {
    status: Status,
    /**
     * Default: `small`.
     */
    size?: Size,
}

type Size = SpinnerProps["size"];

function matchSizeToFont(size: Size): number {
    switch (size) {
        case "extra-tiny":
            return 18;
        case "tiny":
            return 22;
        case "extra-small":
            return 26;
        case "medium":
            return 38;
        case "large":
            return 44;
        case "extra-large":
            return 48;
        case "huge":
            return 56;
        case "small":
        default:
            return 32;
    }
}
