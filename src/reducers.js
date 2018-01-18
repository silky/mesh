'use strict';

const CT = require('./code_transformers');
const {get_selected_cell} = require('./selectors');
const {EMPTY_CELL} = require('./display');
const {LINE_SEPARATOR} = require('./settings');
const {cell_AST_change_bindings} = require('./cell_AST_change_bindings');

const BLANK_FILE = [
// Maybe get rid of this line if always intended to be consumed as ES6 modules?
    "'use strict';", 
    "const SHEET_ROOT = {",
    "    __mesh_grid__: {}",
    "}"
// Add ES6 export line?
].join(LINE_SEPARATOR + LINE_SEPARATOR);

const INITIAL_STATE = {
    mode: 'READY',
    // TODO do I have to tell cells where they are? Alt: do I have to use locations as keys?
    // Alt 2: why can't the cells come through as a key-value map? Then really can skip
    // duplication of location... unless needed by React?
    cells: { '[0, 0]': Object.assign({}, EMPTY_CELL, {location: [0, 0]}) },
    selected_cell_loc: [0, 0],
    code_editor: { value: BLANK_FILE, selection: undefined, show: true },
    filepath: null,
}

// TODO is there a more brief alternative to Object.assign?
// TODO can we get rid of all the (state, action) signatures?
const state_changes = {

    'RESET_STATE': (state, action) => Object.assign({}, state, INITIAL_STATE),

    /* CODE PANE */

    'SELECT_CODE': (state, action) => Object.assign({}, state, {mode: 'EDITING_CODE'}),

    'TOGGLE_CODE_PANE_SHOW': (state, action) => {
        const bool = !state.code_editor.show;
        const code_editor = Object.assign({}, state.code_editor, {show: bool});
        return Object.assign({}, state, code_editor);
    },

    'LOAD_CODE': (state, action) => Object.assign({}, state, {
        code_editor: Object.assign({}, state.code_editor, {value: action.code}),
        mode: 'NEED_TO_CALCULATE',
    }),

    'LOAD_CODE_FROM_PANE': (state, action) => Object.assign({}, state, {
        mode: 'LOAD_CODE_FROM_PANE', 
    }),

    /* CALCULATION */

    'CALCULATE': (state, action) => Object.assign({}, state, { mode: 'NEED_TO_CALCULATE', }),

    'ADD_CELLS_TO_SHEET': (state, action) => {
        const new_cells = {};
        for (let cell of action.cells) {
            const cell_id = JSON.stringify(cell.location);
            new_cells[cell_id] = cell;
        }
        return Object.assign({}, state, { mode: 'PRE_READY', cells: new_cells })
    },
    
    'RETURN_TO_READY': (state, action) => Object.assign({}, state, {mode: 'READY'}),

    /* CELL BEHAVIOUR */

    'SELECT_CELL': (state, action) => Object.assign({}, state, {
        selected_cell_loc: action.location
    }),

    'MOVE_CELL_SELECTION': (state, action) => {
        const [old_row_idx, old_col_idx] = state.selected_cell_loc;
        const [offset_r, offset_c] = action.offset;
        const new_location = [
            Math.max(0, old_row_idx + offset_r),
            Math.max(0, old_col_idx + offset_c),
        ];
        return Object.assign({}, state, {selected_cell_loc: new_location});
    },

    'EDIT_CELL': (state, action) => Object.assign({}, state, {mode: 'EDIT'}),

    'EDIT_CELL_REPLACE': (state, action) => {
        let new_props = (state.mode === 'EDIT') ? {} : {mode: 'EDIT_REPLACE'};
        return Object.assign({}, state, new_props);
    },

    'DISCARD_CELL_EDIT': (state, action) => Object.assign({}, state, {
        mode: 'READY',
        formula_bar_value: this.formula_bar_value,
    }),

    'EDIT_AST': (state, action) => {
        const old_code = state.code_editor.value;
        const AST = CT.parse_code_string_to_AST(old_code);
        const mesh_obj_node = CT.get_root_mesh_obj_node(AST);

        const fns_label = get_selected_cell(state).cell_AST_changes_type;
        const AST_change_fns = cell_AST_change_bindings[fns_label];
        const AST_change_fn = AST_change_fns[action.AST_edit_type] 

        // TODO pass in fn arguments etc, instead of whole action? (Probs need whole action)
        // TODO should this also pass in the selected cell,
        // instead of the whole state?
        const selection_offset = AST_change_fn(mesh_obj_node, state, action);

        const [old_row, old_col] = state.selected_cell_loc;
        const new_code = CT.print_AST_to_code_string(AST);
        return Object.assign({}, state, {
            code_editor: Object.assign({}, state.code_editor, {value: new_code}),
            mode: 'NEED_TO_CALCULATE',
            // TODO Merge with select code somehow? (Feels like select should just be a 'refresh ready')
            // TODO these 'row + offset, col + offset' logics are basically the same
            // as what the main reducer is doing...
            selected_cell_loc: [
                old_row + selection_offset[0], 
                old_col + selection_offset[1]
            ],
        });
    },

    /* OTHER */

    'SET_FILEPATH': (state, action) => Object.assign({}, state, {filepath: action.filepath}),

}

const app = function (state = INITIAL_STATE, action) {
    const reducer = state_changes[action.type];
    if (reducer !== undefined) {
        return reducer(state, action);
    } else {
        console.error("NO ACTION FOUND FOR:", action)
        return state;
    }
}

module.exports = { app }
