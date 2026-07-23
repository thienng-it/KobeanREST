mod http_client;
mod local_only;
mod persistence;
mod secrets;

use http_client::execute_http_request;
use local_only::{app_contract, check_for_update, local_storage_status, request_auth_modes};
use persistence::{
    clear_request_history, create_environment, create_folder, create_request, delete_environment,
    delete_collection, delete_folder, delete_request, delete_scoped_variable, delete_variable,
    export_workspace_data, get_scoped_variables, import_workspace_data, initialize_persistence,
    load_app_settings, load_request_history, load_workspace, record_request_history,
    rename_environment, save_app_settings, save_request, save_scoped_secret_variable,
    save_scoped_variable, save_secret_variable, save_variable, set_active_environment,
    update_collection, update_folder, get_scripts, save_script, delete_script, save_folder_auth,
    save_collection_auth, create_workspace, create_collection
};
use secrets::{delete_secret, resolve_secrets, store_secret};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
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
            initialize_persistence,
            load_workspace,
            record_request_history,
            store_secret,
            delete_secret,
            resolve_secrets,
            request_auth_modes,
            local_storage_status,
            check_for_update,
            export_workspace_data,
            import_workspace_data,
            save_request,
            delete_request,
            create_folder,
            update_folder,
            update_collection,
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
            save_script,
            delete_script,
            save_folder_auth,
            save_collection_auth
        ])
        .run(tauri::generate_context!())
        .expect("failed to run KobeanREST");
}
