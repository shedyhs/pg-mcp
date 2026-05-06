import { DisconnectSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
export async function handleDisconnect(args) {
    const input = DisconnectSchema.parse(args);
    const conn = connections.get(input.connectionId);
    if (!conn) {
        return {
            content: [
                {
                    type: "text",
                    text: `Connection '${input.connectionId}' not found.`,
                },
            ],
            isError: true,
        };
    }
    await conn.pool.end();
    connections.delete(input.connectionId);
    return {
        content: [
            {
                type: "text",
                text: `Disconnected from '${input.connectionId}' successfully.`,
            },
        ],
    };
}
