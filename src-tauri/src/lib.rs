mod http_client;
mod local_only;
mod mcp_server;
mod mock_server;
mod oauth;
mod persistence;
mod secrets;
mod spec_generator;

use http_client::execute_http_request;
use local_only::{app_contract, check_for_update, local_storage_status, request_auth_modes};
use mcp_server::{execute_mcp_tool_call, export_mcp_manifest};
use mock_server::{
    clear_mock_request_log, get_mock_request_log, get_mock_routes, get_mock_server_status,
    set_mock_routes, start_local_mock_server, stop_local_mock_server, MockServerState,
};
use oauth::start_oauth_login;
use persistence::{
    clear_request_history, create_collection, create_environment, create_folder, create_request,
    create_workspace, delete_collection, delete_environment, delete_folder, delete_request,
    delete_scoped_variable, delete_script, delete_variable, delete_workspace,
    export_workspace_data, get_all_scripts, get_scoped_variables, get_scripts,
    import_workspace_data, initialize_persistence, list_workspaces, load_app_settings,
    load_collection_run_details, load_collection_runs, load_history_response, load_request_history,
    load_workspace, load_workspace_by_id, move_folder, record_request_history, rename_environment,
    rename_workspace, save_app_settings, save_collection_auth, save_collection_description,
    save_folder_auth, save_folder_description, save_request,
    save_scoped_secret_variable, save_scoped_variable, save_script, save_secret_variable,
    save_variable, set_active_environment, switch_workspace, update_collection,
    update_collection_default_environment, update_folder,
};
use secrets::{delete_secret, resolve_secrets, store_secret};
use spec_generator::{export_openapi_30_spec, import_openapi_30_spec};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(MockServerState::default())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let salt_path = app_data_dir.join("stronghold-salt.txt");

            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            persistence::ensure_database(app.handle()).map_err(std::io::Error::other)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_contract,
            execute_http_request,
            start_oauth_login,
            initialize_persistence,
            load_workspace,
            record_request_history,
            load_history_response,
            store_secret,
            delete_secret,
            resolve_secrets,
            request_auth_modes,
            local_storage_status,
            check_for_update,
            export_workspace_data,
            import_workspace_data,
            persistence::reorder_items,
            save_request,
            delete_request,
            create_folder,
            update_folder,
            update_collection,
            update_collection_default_environment,
            move_folder,
            delete_collection,
            delete_folder,
            create_request,
            create_environment,
            rename_environment,
            delete_environment,
            set_active_environment,
            save_variable,
            delete_variable,
            save_secret_variable,
            save_scoped_variable,
            save_scoped_secret_variable,
            delete_scoped_variable,
            get_scoped_variables,
            load_request_history,
            clear_request_history,
            load_app_settings,
            save_app_settings,
            create_workspace,
            create_collection,
            get_scripts,
            get_all_scripts,
            save_script,
            delete_script,
            save_folder_auth,
            save_collection_auth,
            save_folder_description,
            save_collection_description,
            list_workspaces,
            rename_workspace,
            delete_workspace,
            switch_workspace,
            load_workspace_by_id,
            load_collection_runs,
            load_collection_run_details,
            start_local_mock_server,
            stop_local_mock_server,
            get_mock_server_status,
            set_mock_routes,
            get_mock_routes,
            get_mock_request_log,
            clear_mock_request_log,
            export_openapi_30_spec,
            import_openapi_30_spec,
            export_mcp_manifest,
            execute_mcp_tool_call
        ])
        .run(tauri::generate_context!())
        .expect("failed to run KobeanREST");
}
