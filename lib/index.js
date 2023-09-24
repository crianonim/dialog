"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplitStringOnNL = exports.getStatusLine = exports.getVisibleOptions = exports.generateNewGameDefinition = exports.generateNewDialog = exports.updateDialogText = exports.updateDialogAction = exports.updateDialogOption = exports.updateDialogOptions = exports.updateDialog = exports.createGameDefinitionAction = exports.gameDefinitionReducer = exports.gameStateReducer = exports.getDialogFromStack = exports.getDialogById = exports.schemaGameDefinition = exports.schemaGameState = void 0;
const S = __importStar(require("@crianonim/screept"));
const ts_pattern_1 = require("ts-pattern");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
exports.schemaGameState = zod_1.z.object({
    dialogStack: zod_1.z.array(zod_1.z.string()),
    screeptEnv: S.schemaEnvironment,
});
const schemaDialogActionGoBack = zod_1.z.object({
    type: zod_1.z.literal("go back"),
    id: zod_1.z.string(),
});
const schemaDialogActionGoDialog = zod_1.z.object({
    type: zod_1.z.literal("go_dialog"),
    destination: zod_1.z.string(),
    id: zod_1.z.string(),
});
const schemaDialogActionMsg = zod_1.z.object({
    type: zod_1.z.literal("msg"),
    value: S.schemaExpression,
    id: zod_1.z.string(),
});
const schemaDialogActionScreept = zod_1.z.object({
    type: zod_1.z.literal("screept"),
    value: S.schemaStatement,
    id: zod_1.z.string(),
});
const schemaDialogActionConditionalBase = zod_1.z.object({
    type: zod_1.z.literal("conditional"),
    if: S.schemaExpression,
    id: zod_1.z.string(),
});
const schemaDialogActionConditional = schemaDialogActionConditionalBase.extend({
    then: zod_1.z.lazy(() => zod_1.z.array(schemaDialogAction)),
    else: zod_1.z.lazy(() => zod_1.z.array(schemaDialogAction)),
});
const schemaDialogActionBlockBase = zod_1.z.object({
    type: zod_1.z.literal("block"),
    id: zod_1.z.string(),
});
const schemaDialogActionBlock = schemaDialogActionBlockBase.extend({
    actions: zod_1.z.array(zod_1.z.lazy(() => schemaDialogAction)),
});
const schemaDialogAction = zod_1.z.union([
    schemaDialogActionGoBack,
    schemaDialogActionGoDialog,
    schemaDialogActionMsg,
    schemaDialogActionScreept,
    schemaDialogActionConditional,
    schemaDialogActionBlock,
]);
const schemaDialogOption = zod_1.z.object({
    id: zod_1.z.string(),
    text: S.schemaExpression,
    condition: S.schemaExpression.optional(),
    actions: zod_1.z.array(schemaDialogAction),
});
const schemaDialog = zod_1.z.object({
    id: zod_1.z.string(),
    text: S.schemaExpression,
    options: zod_1.z.array(schemaDialogOption),
});
exports.schemaGameDefinition = zod_1.z.object({
    dialogs: zod_1.z.record(schemaDialog),
    gameState: exports.schemaGameState,
});
const BAD_DIALOG = {
    text: S.l(S.t("Bad Dialog")),
    id: "bad",
    options: [
        {
            id: (0, uuid_1.v4)(),
            actions: [{ type: "go back", id: (0, uuid_1.v4)() }],
            text: S.l(S.t("Go Back")),
        },
    ],
};
function getDialogById(id, dialogs) {
    return dialogs[id] || BAD_DIALOG;
}
exports.getDialogById = getDialogById;
function getDialogFromStack(dialogStack, dialogs) {
    const id = dialogStack[0];
    if (!id || !dialogs[id])
        return BAD_DIALOG;
    else
        return dialogs[id];
}
exports.getDialogFromStack = getDialogFromStack;
function gameStateReducer(state, actions) {
    return actions.reduce((prev, cur) => executeAction(prev, cur), state);
}
exports.gameStateReducer = gameStateReducer;
function executeAction(state, action) {
    return (0, ts_pattern_1.match)(action)
        .with({ type: "go_dialog" }, ({ destination }) => ({
        ...state,
        dialogStack: [destination, ...state.dialogStack],
    }))
        .with({ type: "go back" }, () => ({
        ...state,
        dialogStack: state.dialogStack.slice(1),
    }))
        .with({ type: "block" }, ({ actions }) => gameStateReducer(state, actions))
        .with({ type: "conditional" }, (a) => {
        const condition = S.isTruthy(S.evaluateExpression(state.screeptEnv, a.if));
        return condition
            ? gameStateReducer(state, a.then)
            : gameStateReducer(state, a.else);
    })
        .with({ type: "screept" }, ({ value }) => ({
        ...state,
        screeptEnv: S.runStatement(state.screeptEnv, value),
    }))
        .with({ type: "msg" }, ({ value }) => {
        const newOutput = S.getStringValue(S.evaluateExpression(state.screeptEnv, value));
        return {
            ...state,
            screeptEnv: S.addOutputToEnvironment(state.screeptEnv, newOutput),
        };
    })
        .exhaustive();
}
function gameDefinitionReducer(state, action) {
    const newState = (0, ts_pattern_1.match)(action)
        .with({ type: "gamestate" }, ({ actions }) => ({
        ...state,
        gameState: gameStateReducer(state.gameState, actions),
    }))
        .with({ type: "add-go-back" }, ({ dialogId }) => {
        const dialog = state.dialogs[dialogId];
        if (!dialog)
            return state;
        const options = [
            ...dialog.options,
            {
                actions: [{ type: "go back", id: (0, uuid_1.v4)() }],
                text: S.l(S.t("..")),
                id: (0, uuid_1.v4)(),
            },
        ];
        const newState = { ...state };
        newState.dialogs[dialogId] = { ...dialog, options };
        return newState;
    })
        .with({ type: "update dialogs" }, ({ dialogs }) => ({
        ...state,
        dialogs,
    }))
        .with({ type: "replace" }, ({ newState }) => ({
        ...state,
        gameState: newState,
    }))
        .with({ type: "replace game definition" }, ({ newGameDefinition }) => ({
        ...newGameDefinition,
    }))
        .with({ type: "update gamestate" }, ({ fn }) => ({
        ...state,
        gameState: fn(state.gameState),
    }))
        .exhaustive();
    return newState;
}
exports.gameDefinitionReducer = gameDefinitionReducer;
function createGameDefinitionAction(actions) {
    return { type: "gamestate", actions };
}
exports.createGameDefinitionAction = createGameDefinitionAction;
function updateDialog(dialogs, dialogId, fn) {
    const dialog = dialogs[dialogId];
    const newDialog = fn(dialog);
    const newDialogs = { ...dialogs };
    if (dialogId !== newDialog.id) {
        delete dialogs[dialogId];
    }
    newDialogs[newDialog.id] = newDialog;
    return newDialogs;
}
exports.updateDialog = updateDialog;
function updateDialogOptions(dialogs, dialogId, options) {
    return updateDialog(dialogs, dialogId, (d) => ({ ...d, options }));
}
exports.updateDialogOptions = updateDialogOptions;
function updateDialogOption(dialogs, dialogId, optionId, fn) {
    return updateDialog(dialogs, dialogId, (d) => ({
        ...d,
        options: d.options.map((o) => (o.id === optionId ? fn(o) : o)),
    }));
}
exports.updateDialogOption = updateDialogOption;
function updateDialogAction(dialogs, dialogId, optionId, actionId, fn) {
    function updateActionInTree(a) {
        return a.type === "conditional" && a.id !== actionId
            ? {
                ...a,
                then: a.then.map(updateActionInTree),
                else: a.else.map(updateActionInTree),
            }
            : a.id === actionId
                ? fn(a)
                : a;
    }
    return updateDialogOption(dialogs, dialogId, optionId, (d) => ({
        ...d,
        actions: d.actions.map(updateActionInTree),
    }));
}
exports.updateDialogAction = updateDialogAction;
// todo remove and use inline
function updateDialogText(dialogs, text, dialogId) {
    return updateDialog(dialogs, dialogId, (d) => ({ ...d, text }));
}
exports.updateDialogText = updateDialogText;
function generateNewDialog(id) {
    return {
        id,
        text: S.l(S.t("New dialog" + id)),
        options: [],
    };
}
exports.generateNewDialog = generateNewDialog;
function generateNewGameDefinition() {
    return {
        dialogs: { start: generateNewDialog("start") },
        gameState: {
            screeptEnv: {
                vars: {},
                procedures: {},
                output: [],
            },
            dialogStack: ["start"],
        },
    };
}
exports.generateNewGameDefinition = generateNewGameDefinition;
function getVisibleOptions(options, environment) {
    const specialOption = environment.vars["_specialOption"] &&
        S.getStringValue(environment.vars["_specialOption"]) !== "0" && {
        text: S.l(S.t("Menu")),
        id: (0, uuid_1.v4)(),
        actions: [
            {
                type: "screept",
                value: {
                    type: "bind",
                    identifier: { type: "literal", value: "_specialOption" },
                    value: { type: "literal", value: { type: "number", value: 0 } },
                },
                id: (0, uuid_1.v4)(),
            },
            {
                type: "go_dialog",
                destination: S.getStringValue(environment.vars["_specialOption"]),
                id: (0, uuid_1.v4)(),
            },
        ],
    };
    return (specialOption ? [...options, specialOption] : options).filter((option) => !option.condition ||
        S.isTruthy(S.evaluateExpression(environment, option.condition)));
}
exports.getVisibleOptions = getVisibleOptions;
function getStatusLine(environment) {
    if ("__statusLine" in environment.vars)
        return S.getStringValue(S.evaluateExpression(environment, S.parseExpression("__statusLine()")));
}
exports.getStatusLine = getStatusLine;
function getSplitStringOnNL(e, env) {
    return S.getStringValue(S.evaluateExpression(env, e)).split("<nl>");
}
exports.getSplitStringOnNL = getSplitStringOnNL;
