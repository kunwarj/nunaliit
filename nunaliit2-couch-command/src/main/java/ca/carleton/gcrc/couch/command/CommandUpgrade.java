package ca.carleton.gcrc.couch.command;

import java.io.File;
import java.io.PrintStream;
import java.util.Calendar;
import java.util.Stack;

import ca.carleton.gcrc.couch.command.impl.FileSetManifest;
import ca.carleton.gcrc.couch.command.impl.PathComputer;
import ca.carleton.gcrc.couch.command.impl.UpgradeOperations;
import ca.carleton.gcrc.couch.command.impl.UpgradeOperationsBasic;
import ca.carleton.gcrc.couch.command.impl.UpgradeOperationsNull;
import ca.carleton.gcrc.couch.command.impl.UpgradeOperationsReporting;
import ca.carleton.gcrc.couch.command.impl.UpgradeProcess;
import ca.carleton.gcrc.couch.command.impl.UpgradeReport;

public class CommandUpgrade implements Command {

	@Override
	public String getCommandString() {
		return "upgrade";
	}

	@Override
	public boolean matchesKeyword(String keyword) {
		if( getCommandString().equalsIgnoreCase(keyword) ) {
			return true;
		}
		return false;
	}

	@Override
	public boolean requiresAtlasDir() {
		return true;
	}

	@Override
	public void reportHelp(PrintStream ps) {
		ps.println("Nunaliit2 Atlas Framework - Upgrade Command");
		ps.println();
		ps.println("The upgrade command allows a user to modifies the files located in an atlas");
		ps.println("so that they correspond to a different version of Nunaliit. This command");
		ps.println("should be used when a newer version of Nunaliit is available and the");
		ps.println("atlas creator wishes to use the newer version.");
		ps.println();
		ps.println("Command Syntax:");
		ps.println("  nunaliit [<global-options>] upgrade [<upgrade-options>]");
		ps.println();
		ps.println("Global Options");
		CommandHelp.reportGlobalSettingAtlasDir(ps);
		ps.println();
		ps.println("Upgrade Options");
		ps.println("  --test   Does not perform any changes. Simply print");
		ps.println("           what would happen");
	}

	@Override
	public void runCommand(
		GlobalSettings gs
		,Stack<String> argumentStack
		) throws Exception {
		
		// Pick up options
		boolean justTest = false;
		while( false == argumentStack.empty() ){
			String optionName = argumentStack.peek();
			if( "--test".equals(optionName) ){
				argumentStack.pop();
				justTest = true;
			} else {
				break;
			}
		}

		
		File atlasDir = gs.getAtlasDir();

		// Verify that content directory is available
		File contentDir = PathComputer.computeContentDir( gs.getInstallDir() );
		if( null == contentDir 
		 || false == contentDir.exists() 
		 || false == contentDir.isDirectory() ){
			throw new Exception("Unable to find content directory");
		}
		
		// Compute upgrade directory
		File upgradeCollisionDir = null;
		{
			Calendar calendar = Calendar.getInstance();
			String name = String.format(
				"upgrade_%04d-%02d-%02d_%02d:%02d:%02d"
				,calendar.get(Calendar.YEAR)
				,(calendar.get(Calendar.MONTH)+1)
				,calendar.get(Calendar.DAY_OF_MONTH)
				,calendar.get(Calendar.HOUR_OF_DAY)
				,calendar.get(Calendar.MINUTE)
				,calendar.get(Calendar.SECOND)
				);
			upgradeCollisionDir = new File(atlasDir, "upgrade/"+name);
		}
		
		// Figure out upgrade operations
		UpgradeOperations operations = null;
		if( justTest ) {
			operations = new UpgradeOperationsReporting(
				new UpgradeOperationsNull()
				,gs.getOutStream()
				);
		} else {
			operations = new UpgradeOperationsBasic(
				atlasDir
				,contentDir
				,upgradeCollisionDir
				);
		}

		// Upgrade content
		try {
			UpgradeProcess upgradeProcess = new UpgradeProcess();
			UpgradeReport upgradeReport = upgradeProcess.computeUpgrade(
				contentDir
				,atlasDir
				,new FileSetManifest() // new installation
				);
			
			upgradeProcess.performUpgrade(
				upgradeReport
				,operations
				);
		
		} catch(Exception e) {
			throw new Exception("Unable to upgrade content",e);
		}
	}
}
